using Cortex.Mediator;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Search;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Net.Http.Json;

namespace NitroGroups.Tests.Endpoints.Groups;

public class SearchEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _anonymous;
    private readonly IMediator _mediator;

    public SearchEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _mediator = factory.Mediator;
    }

    [Fact]
    public async Task Buscar_SinSesion_Returns200_YPasaLosFiltros()
    {
        _mediator
            .SendQueryAsync<SearchGroupsQuery, PagedResult<GroupSearchItem>>(Arg.Any<SearchGroupsQuery>())
            .Returns(new PagedResult<GroupSearchItem>([new GroupSearchItem { Slug = "vargas", GroupName = "Mariachi Vargas" }], 1, 1, 12));

        var response = await _anonymous.GetAsync("api/groups/search?q=mariachi&genre=mariachi&city=cdmx&maxPrice=15000&date=2026-12-12&page=2&size=6");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("vargas", body.RootElement.GetProperty("items")[0].GetProperty("slug").GetString());
        Assert.Equal(1, body.RootElement.GetProperty("totalCount").GetInt32());
        await _mediator.Received().SendQueryAsync<SearchGroupsQuery, PagedResult<GroupSearchItem>>(Arg.Is<SearchGroupsQuery>(q =>
            q.Text == "mariachi" && q.GenreSlug == "mariachi" && q.City == "cdmx" && q.MaxPrice == 15000
            && q.Date == new DateOnly(2026, 12, 12) && q.Page == 2 && q.Size == 6));
    }

    [Fact]
    public async Task Buscar_PresupuestoNegativo_Returns400()
    {
        var response = await _anonymous.GetAsync("api/groups/search?maxPrice=-1");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Buscar_SinFecha_NoEnviaFechaAlBuscador()
    {
        _mediator
            .SendQueryAsync<SearchGroupsQuery, PagedResult<GroupSearchItem>>(Arg.Any<SearchGroupsQuery>())
            .Returns(new PagedResult<GroupSearchItem>([], 0, 1, 12));

        var response = await _anonymous.GetAsync("api/groups/search");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<SearchGroupsQuery, PagedResult<GroupSearchItem>>(
            Arg.Is<SearchGroupsQuery>(q => q.Date == null));
    }
}
