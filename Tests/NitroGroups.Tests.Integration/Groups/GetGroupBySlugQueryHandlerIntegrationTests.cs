using NitroGroups.Core.Groups.Application.UseCases.Groups.GetBySlug;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

public class GetGroupBySlugQueryHandlerIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture = fixture;

    [Fact]
    public async Task Handle_CuandoExiste_DeberiaRetornarGrupoConGenresYMedia()
    {
        await using var context = _fixture.CreateGroupsContext();
        var mapper = _fixture.CreateMapper();
        var unitOfWork = _fixture.CreateGroupsUnitOfWork(context);
        var handler = new GetGroupBySlugQueryHandler(unitOfWork, mapper);

        var group = new Group
        {
            OwnerUserId = 10,
            Slug = "fusion-band",
            GroupName = "Fusion Band",
            Active = true,
            IsAcceptingBookings = true,
            Currency = "MXN",
            Email = "fusion@example.com",
            Phone = "5551231234"
        };
        var genre = new MusicGenre
        {
            Name = "Jazz",
            Slug = "jazz",
            ColorHex = "#123456",
            IsActive = true
        };
        context.Groups.Add(group);
        context.MusicGenres.Add(genre);
        await context.SaveChangesAsync();

        context.GroupGenres.Add(new GroupGenre
        {
            GroupId = group.Id,
            GenreId = genre.Id,
            IsPrimary = true
        });
        context.GroupMedia.Add(new GroupMedia
        {
            GroupId = group.Id,
            Type = MediaType.Photo,
            Url = "https://cdn.test/photo.jpg",
            Title = "Promo",
            Description = "Foto promo",
            DisplayOrder = 1,
            IsPrimary = true
        });
        await context.SaveChangesAsync();

        var result = await handler.Handle(new GetGroupBySlugQuery("fusion-band"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("fusion-band", result.Value!.Slug);
        Assert.Single(result.Value.Genres);
        Assert.Single(result.Value.Media);
        Assert.Equal("Jazz", result.Value.Genres[0].Name);
        Assert.Equal("photo", result.Value.Media[0].Type);
    }

    [Fact]
    public async Task Handle_CuentaIntegrantesReales_SinContarLasMembresiasInactivas()
    {
        await using var context = _fixture.CreateGroupsContext();
        var mapper = _fixture.CreateMapper();
        var unitOfWork = _fixture.CreateGroupsUnitOfWork(context);
        var handler = new GetGroupBySlugQueryHandler(unitOfWork, mapper);

        // El perfil declara cuatro a mano; el equipo real tiene cinco activos y una baja.
        var group = new Group
        {
            OwnerUserId = 10,
            Slug = "cuenta-real",
            GroupName = "Cuenta Real",
            Active = true,
            Currency = "MXN",
            NumMembers = 4
        };
        context.Groups.Add(group);
        await context.SaveChangesAsync();

        for (var index = 0; index < 5; index++)
            context.GroupMembers.Add(Member(group.Id, userId: 100 + index, active: true));
        context.GroupMembers.Add(Member(group.Id, userId: 200, active: false));
        await context.SaveChangesAsync();

        var result = await handler.Handle(new GetGroupBySlugQuery("cuenta-real"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(5, result.Value!.NumMembers);
    }

    private static GroupMember Member(long groupId, long userId, bool active) => new()
    {
        GroupId = groupId,
        UserId = userId,
        Role = GroupMemberRole.Member,
        IsActive = active,
        JoinedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        LeftAt = active ? null : new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
        JoinedVia = JoinedVia.Manual
    };

    [Fact]
    public async Task Handle_CuandoNoExiste_DeberiaRetornarFailure()
    {
        await using var context = _fixture.CreateGroupsContext();
        var mapper = _fixture.CreateMapper();
        var unitOfWork = _fixture.CreateGroupsUnitOfWork(context);
        var handler = new GetGroupBySlugQueryHandler(unitOfWork, mapper);

        var result = await handler.Handle(new GetGroupBySlugQuery("missing-slug"), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Group not found.", result.Error);
    }
}
