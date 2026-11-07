using Cortex.Mediator;
using NitroGroups.Core.Users.Application.UseCases.Musicians.SearchDirectory;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Users;

/// <summary>S1, S2: GET api/musicians is the public directory; it works with no token and has no email.</summary>
public class MusicianDirectoryEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _anonymous;
    private readonly IMediator _mediator;

    public MusicianDirectoryEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _mediator = factory.Mediator;
    }

    private void SearchReturns(PagedResult<MusicianDirectoryItem> page)
        => _mediator
            .SendQueryAsync<SearchMusicianDirectoryQuery, PagedResult<MusicianDirectoryItem>>(Arg.Any<SearchMusicianDirectoryQuery>())
            .Returns(page);

    [Fact]
    public async Task Get_WithoutToken_Returns200WithTheExactItemShapeAndNoEmail()
    {
        SearchReturns(new PagedResult<MusicianDirectoryItem>(
            [new MusicianDirectoryItem
            {
                UserId = 7,
                FullName = "Ana López",
                Headline = "Bajista",
                Instruments = "Bajo",
                City = "Rosario",
                YearsExperience = 4,
                ProfilePictureUrl = "https://cdn.test/a.png"
            }],
            1, 1, 12));

        var response = await _anonymous.GetAsync("api/musicians");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("email", raw, StringComparison.OrdinalIgnoreCase);

        using var body = JsonDocument.Parse(raw);
        var item = body.RootElement.GetProperty("items")[0];
        Assert.Equal(
            new[] { "city", "fullName", "headline", "instruments", "profilePictureUrl", "userId", "yearsExperience" },
            item.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal(7, item.GetProperty("userId").GetInt64());
        Assert.Equal("Ana López", item.GetProperty("fullName").GetString());
        Assert.Equal("Bajista", item.GetProperty("headline").GetString());
        Assert.Equal("Bajo", item.GetProperty("instruments").GetString());
        Assert.Equal("Rosario", item.GetProperty("city").GetString());
        Assert.Equal(4, item.GetProperty("yearsExperience").GetInt32());
        Assert.Equal("https://cdn.test/a.png", item.GetProperty("profilePictureUrl").GetString());
        Assert.Equal(1, body.RootElement.GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task Get_PassesTheFiltersAndPagingToTheQuery()
    {
        SearchReturns(new PagedResult<MusicianDirectoryItem>([], 0, 2, 5));

        await _anonymous.GetAsync("api/musicians?query=ana&instrument=bajo&city=rosario&page=2&size=5");

        await _mediator.Received().SendQueryAsync<SearchMusicianDirectoryQuery, PagedResult<MusicianDirectoryItem>>(
            Arg.Is<SearchMusicianDirectoryQuery>(q =>
                q.Query == "ana" && q.Instrument == "bajo" && q.City == "rosario" && q.Page == 2 && q.Size == 5));
    }

    [Fact]
    public async Task Get_WithoutParameters_UsesPageOneOfTwelve()
    {
        SearchReturns(new PagedResult<MusicianDirectoryItem>([], 0, 1, 12));

        await _anonymous.GetAsync("api/musicians");

        await _mediator.Received().SendQueryAsync<SearchMusicianDirectoryQuery, PagedResult<MusicianDirectoryItem>>(
            Arg.Is<SearchMusicianDirectoryQuery>(q =>
                q.Query == null && q.Instrument == null && q.City == null && q.Page == 1 && q.Size == 12));
    }
}
