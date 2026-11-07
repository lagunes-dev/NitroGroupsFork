using System.Text.Json;
using NitroGroups.Core.Users.Application.UseCases.Musicians.SearchOpenToJoin;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Users;

/// <summary>
/// S2: la búsqueda de músicos respeta <c>IsOpenToJoin</c>, ignora usuarios inactivos,
/// busca por nombre y nunca devuelve el email.
/// </summary>
public class SearchOpenMusiciansHandlerIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;

    public SearchOpenMusiciansHandlerIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    private static long AddMusician(
        UsersDbContext context,
        string firstName,
        string lastName,
        bool isOpenToJoin,
        bool active = true,
        int yearsExperience = 0)
    {
        var user = new User(
            $"auth0|{firstName}.{lastName}".ToLowerInvariant(),
            $"{firstName}.{lastName}@example.com".ToLowerInvariant(),
            firstName,
            lastName,
            UserType.Musician);
        context.Users.Add(user);

        if (!active)
            context.Entry(user).Property(u => u.Active).CurrentValue = false;

        context.SaveChanges();

        context.Musicians.Add(new Musician
        {
            UserId = user.Id,
            IsOpenToJoin = isOpenToJoin,
            YearsExperience = yearsExperience
        });
        context.SaveChanges();

        return user.Id;
    }

    private static SearchOpenMusiciansQueryHandler CreateHandler(UsersDbContext context, IntegrationTestFixture fixture)
        => new(fixture.CreateUsersUnitOfWork(context));

    [Fact]
    public async Task Handle_SoloMusicosAbiertosALaUnion_Aparecen()
    {
        await using var context = _fixture.CreateUsersContext();
        var open = AddMusician(context, "Ana", "López", isOpenToJoin: true, yearsExperience: 3);
        AddMusician(context, "Beto", "Cerrado", isOpenToJoin: false);

        var result = await CreateHandler(context, _fixture)
            .Handle(new SearchOpenMusiciansQuery(null, 1, 10), CancellationToken.None);

        var item = Assert.Single(result.Items);
        Assert.Equal(open, item.UserId);
        Assert.Equal("Ana López", item.FullName);
        Assert.Equal(3, item.YearsExperience);
    }

    [Fact]
    public async Task Handle_UsuarioInactivo_NoAparece()
    {
        await using var context = _fixture.CreateUsersContext();
        var active = AddMusician(context, "Ana", "López", isOpenToJoin: true);
        AddMusician(context, "Inés", "Inactiva", isOpenToJoin: true, active: false);

        var result = await CreateHandler(context, _fixture)
            .Handle(new SearchOpenMusiciansQuery(null, 1, 10), CancellationToken.None);

        var item = Assert.Single(result.Items);
        Assert.Equal(active, item.UserId);
    }

    [Theory]
    [InlineData("ana")]        // nombre
    [InlineData("lópez")]      // apellido
    [InlineData("ana lópez")]  // "nombre apellido"
    [InlineData("ANA LÓPEZ")]  // sin importar mayúsculas
    [InlineData("lóp")]        // coincidencia parcial
    public async Task Handle_BuscaPorNombre_SinImportarMayusculas(string text)
    {
        await using var context = _fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López", isOpenToJoin: true);
        AddMusician(context, "Beto", "Ruiz", isOpenToJoin: true);

        var result = await CreateHandler(context, _fixture)
            .Handle(new SearchOpenMusiciansQuery(text, 1, 10), CancellationToken.None);

        var item = Assert.Single(result.Items);
        Assert.Equal("Ana López", item.FullName);
    }

    [Fact]
    public async Task Handle_PaginaYCuentaElTotal()
    {
        await using var context = _fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López", isOpenToJoin: true);
        AddMusician(context, "Beto", "Ruiz", isOpenToJoin: true);
        AddMusician(context, "Carla", "Sosa", isOpenToJoin: true);

        var handler = CreateHandler(context, _fixture);

        var first = await handler.Handle(new SearchOpenMusiciansQuery(null, 1, 2), CancellationToken.None);
        Assert.Equal(["Ana López", "Beto Ruiz"], first.Items.Select(i => i.FullName));
        Assert.Equal(3, first.TotalCount);
        Assert.Equal(1, first.PageNumber);
        Assert.Equal(2, first.PageSize);
        Assert.True(first.HasNextPage);

        var second = await handler.Handle(new SearchOpenMusiciansQuery(null, 2, 2), CancellationToken.None);
        Assert.Equal("Carla Sosa", Assert.Single(second.Items).FullName);
        Assert.Equal(3, second.TotalCount);
        Assert.True(second.HasPreviousPage);
        Assert.False(second.HasNextPage);
    }

    [Fact]
    public async Task Handle_NoExponeEmail()
    {
        // La privacidad la garantiza el tipo: OpenMusicianSummary no es UserSummary y no tiene correo.
        Assert.NotEqual(typeof(UserSummary), typeof(OpenMusicianSummary));
        Assert.DoesNotContain(
            typeof(OpenMusicianSummary).GetProperties(),
            property => property.Name.Contains("email", StringComparison.OrdinalIgnoreCase));

        await using var context = _fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López", isOpenToJoin: true);

        var result = await CreateHandler(context, _fixture)
            .Handle(new SearchOpenMusiciansQuery(null, 1, 10), CancellationToken.None);

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Contains("fullName", json);
        Assert.Contains("Ana", json);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@example.com", json, StringComparison.OrdinalIgnoreCase);
    }
}
