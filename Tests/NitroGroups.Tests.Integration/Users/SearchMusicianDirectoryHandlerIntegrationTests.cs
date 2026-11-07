using System.Text.Json;
using NitroGroups.Core.Users.Application.UseCases.Musicians.SearchDirectory;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Users;

/// <summary>
/// S1, S2: the public directory lists only musicians open to join with an active account, filters
/// by name, instrument and city (case-insensitive "contains", combined with AND), pages like the
/// private open-to-join search and never exposes an email.
/// </summary>
public class SearchMusicianDirectoryHandlerIntegrationTests(IntegrationTestFixture fixture)
    : IClassFixture<IntegrationTestFixture>
{
    private static long AddMusician(
        UsersDbContext context,
        string firstName,
        string lastName,
        bool isOpenToJoin = true,
        bool active = true,
        string? instruments = null,
        string? city = null,
        string? headline = null,
        int yearsExperience = 0)
    {
        var user = new User(
            $"auth0|{Guid.NewGuid():N}",
            $"{firstName}.{lastName}.{Guid.NewGuid():N}@example.com".ToLowerInvariant(),
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
            Instruments = instruments,
            City = city,
            Headline = headline,
            YearsExperience = yearsExperience
        });
        context.SaveChanges();

        return user.Id;
    }

    private SearchMusicianDirectoryQueryHandler Handler(UsersDbContext context)
        => new(fixture.CreateUsersUnitOfWork(context));

    private static SearchMusicianDirectoryQuery Query(
        string? text = null, string? instrument = null, string? city = null, int page = 1, int size = 12)
        => new(text, instrument, city, page, size);

    [Fact]
    public async Task OnlyMusiciansOpenToJoinAppear()
    {
        await using var context = fixture.CreateUsersContext();
        var open = AddMusician(context, "Ana", "López", instruments: "Guitarra", city: "Rosario",
            headline: "Guitarrista", yearsExperience: 7);
        AddMusician(context, "Beto", "Cerrado", isOpenToJoin: false);

        var result = await Handler(context).Handle(Query(), CancellationToken.None);

        var item = Assert.Single(result.Items);
        Assert.Equal(open, item.UserId);
        Assert.Equal("Ana López", item.FullName);
        Assert.Equal("Guitarrista", item.Headline);
        Assert.Equal("Guitarra", item.Instruments);
        Assert.Equal("Rosario", item.City);
        Assert.Equal(7, item.YearsExperience);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task AnInactiveUserDoesNotAppear()
    {
        await using var context = fixture.CreateUsersContext();
        var active = AddMusician(context, "Ana", "López");
        AddMusician(context, "Inés", "Inactiva", active: false);

        var result = await Handler(context).Handle(Query(), CancellationToken.None);

        Assert.Equal(active, Assert.Single(result.Items).UserId);
        Assert.Equal(1, result.TotalCount);
    }

    [Theory]
    [InlineData("bajo")]
    [InlineData("BAJO")]
    [InlineData("baj")]
    public async Task InstrumentFilter_MatchesContainedTextIgnoringCase(string instrument)
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López", instruments: "Guitarra, Bajo");
        AddMusician(context, "Beto", "Ruiz", instruments: "Batería");
        AddMusician(context, "Carla", "Sosa");

        var result = await Handler(context).Handle(Query(instrument: instrument), CancellationToken.None);

        Assert.Equal("Ana López", Assert.Single(result.Items).FullName);
    }

    [Theory]
    [InlineData("rosario")]
    [InlineData("ROSARIO")]
    [InlineData("rosa")]
    public async Task CityFilter_MatchesContainedTextIgnoringCase(string city)
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López", city: "Rosario");
        AddMusician(context, "Beto", "Ruiz", city: "Córdoba");
        AddMusician(context, "Carla", "Sosa");

        var result = await Handler(context).Handle(Query(city: city), CancellationToken.None);

        Assert.Equal("Ana López", Assert.Single(result.Items).FullName);
    }

    [Theory]
    [InlineData("ana")]
    [InlineData("LÓPEZ")]
    [InlineData("ana lópez")]
    public async Task NameQuery_MatchesTheFullNameIgnoringCase(string text)
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López");
        AddMusician(context, "Beto", "Ruiz");

        var result = await Handler(context).Handle(Query(text: text), CancellationToken.None);

        Assert.Equal("Ana López", Assert.Single(result.Items).FullName);
    }

    [Fact]
    public async Task FiltersCombineWithAnd()
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López", instruments: "Bajo", city: "Rosario");
        AddMusician(context, "Ana", "Torres", instruments: "Bajo", city: "Córdoba");
        AddMusician(context, "Ana", "Vega", instruments: "Batería", city: "Rosario");
        AddMusician(context, "Beto", "Ruiz", instruments: "Bajo", city: "Rosario");

        var result = await Handler(context).Handle(
            Query(text: "ana", instrument: "bajo", city: "rosario"), CancellationToken.None);

        Assert.Equal("Ana López", Assert.Single(result.Items).FullName);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task EmptyOrBlankFiltersMeanNoFilter()
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López");
        AddMusician(context, "Beto", "Ruiz", instruments: "Bajo", city: "Rosario");

        var result = await Handler(context).Handle(Query(text: "", instrument: "  ", city: ""), CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
    }

    [Fact]
    public async Task PagesInStableOrderAndCountsTheTotal()
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Carla", "Sosa");
        AddMusician(context, "Ana", "López");
        AddMusician(context, "Beto", "Ruiz");

        var handler = Handler(context);

        var first = await handler.Handle(Query(page: 1, size: 2), CancellationToken.None);
        Assert.Equal(["Ana López", "Beto Ruiz"], first.Items.Select(i => i.FullName));
        Assert.Equal(3, first.TotalCount);
        Assert.Equal(1, first.PageNumber);
        Assert.Equal(2, first.PageSize);
        Assert.True(first.HasNextPage);

        var second = await handler.Handle(Query(page: 2, size: 2), CancellationToken.None);
        Assert.Equal("Carla Sosa", Assert.Single(second.Items).FullName);
        Assert.Equal(3, second.TotalCount);
        Assert.True(second.HasPreviousPage);
        Assert.False(second.HasNextPage);

        var beyond = await handler.Handle(Query(page: 99, size: 2), CancellationToken.None);
        Assert.Empty(beyond.Items);
        Assert.Equal(3, beyond.TotalCount);
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-5, 1)]
    [InlineData(1000, 48)]
    public async Task SizeIsClampedToOneThroughFortyEight(int requested, int expected)
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López");

        var result = await Handler(context).Handle(Query(size: requested), CancellationToken.None);

        Assert.Equal(expected, result.PageSize);
    }

    [Fact]
    public async Task PageBelowOneIsTreatedAsTheFirstPage()
    {
        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López");

        var result = await Handler(context).Handle(Query(page: 0), CancellationToken.None);

        Assert.Equal(1, result.PageNumber);
        Assert.Single(result.Items);
    }

    [Fact]
    public async Task ThePayloadHasNoEmailAndExposesTheCity()
    {
        Assert.DoesNotContain(
            typeof(MusicianDirectoryItem).GetProperties(),
            property => property.Name.Contains("email", StringComparison.OrdinalIgnoreCase));

        await using var context = fixture.CreateUsersContext();
        AddMusician(context, "Ana", "López", city: "Rosario");

        var result = await Handler(context).Handle(Query(), CancellationToken.None);

        var json = JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Contains("\"city\":\"Rosario\"", json);
        Assert.DoesNotContain("email", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("@example.com", json, StringComparison.OrdinalIgnoreCase);
    }
}
