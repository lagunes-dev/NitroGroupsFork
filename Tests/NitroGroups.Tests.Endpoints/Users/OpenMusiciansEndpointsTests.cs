using Cortex.Mediator;
using NitroGroups.Core.Users.Application.UseCases.Musicians.SearchOpenToJoin;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Users;

/// <summary>GET api/musicians/open-to-join: privado y sin email en la respuesta (S2).</summary>
public class OpenMusiciansEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly IMediator _mediator;

    public OpenMusiciansEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _mediator = factory.Mediator;
    }

    [Fact]
    public async Task Buscar_SinToken_Returns401()
    {
        var response = await _anonymous.GetAsync("api/musicians/open-to-join");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Buscar_ConToken_Returns200_ConPayloadSinEmail()
    {
        _mediator
            .SendQueryAsync<SearchOpenMusiciansQuery, PagedResult<OpenMusicianSummary>>(Arg.Any<SearchOpenMusiciansQuery>())
            .Returns(new PagedResult<OpenMusicianSummary>(
                [new OpenMusicianSummary { UserId = 7, FullName = "Ana López", ProfilePictureUrl = "https://cdn.test/a.png", YearsExperience = 4 }],
                1, 1, 10));

        var response = await _client.GetAsync("api/musicians/open-to-join?query=ana&page=2&size=5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var raw = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("email", raw, StringComparison.OrdinalIgnoreCase);

        using var body = JsonDocument.Parse(raw);
        var item = body.RootElement.GetProperty("items")[0];
        Assert.Equal(7, item.GetProperty("userId").GetInt64());
        Assert.Equal("Ana López", item.GetProperty("fullName").GetString());
        Assert.Equal("https://cdn.test/a.png", item.GetProperty("profilePictureUrl").GetString());
        Assert.Equal(4, item.GetProperty("yearsExperience").GetInt32());
        Assert.Equal(1, body.RootElement.GetProperty("totalCount").GetInt32());

        await _mediator.Received().SendQueryAsync<SearchOpenMusiciansQuery, PagedResult<OpenMusicianSummary>>(
            Arg.Is<SearchOpenMusiciansQuery>(q => q.Query == "ana" && q.Page == 2 && q.Size == 5));
    }
}
