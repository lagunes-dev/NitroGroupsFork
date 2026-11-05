using Cortex.Mediator;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetPublicTeam;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Groups;

/// <summary>
/// El equipo con caras en el perfil público del grupo (S14): <c>GET api/groups/{groupId}/team/public</c>
/// responde sin token, con nombre, rol e instrumento · ciudad y sin ningún correo. Es la única
/// superficie pública del equipo; la del manager sigue exigiendo Owner/Manager.
/// </summary>
public class PublicGroupTeamEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long MissingGroupId = 998; // grupo que no existe

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly IMediator _mediator;

    public PublicGroupTeamEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.GroupExistsAsync(MissingGroupId, Arg.Any<CancellationToken>()).Returns(false);
    }

    [Fact]
    public async Task SinToken_DevuelveElEquipoPublico()
    {
        _mediator
            .SendQueryAsync<GetPublicGroupTeamQuery, GroupsResult<List<PublicGroupTeamMemberResponse>>>(Arg.Any<GetPublicGroupTeamQuery>())
            .Returns(GroupsResult<List<PublicGroupTeamMemberResponse>>.Success(
            [
                new PublicGroupTeamMemberResponse
                {
                    UserId = 400,
                    FullName = "Mateo Ruiz",
                    Role = "Manager",
                    Instruments = "Bajo",
                    City = "Guadalajara, Jalisco"
                }
            ]));

        // Cliente anónimo de verdad: el perfil público lo abre cualquiera.
        var response = await _anonymous.GetAsync("api/groups/10/team/public");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetPublicGroupTeamQuery, GroupsResult<List<PublicGroupTeamMemberResponse>>>(
            Arg.Is<GetPublicGroupTeamQuery>(q => q.GroupId == 10));

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("@", body); // nunca correos
        using var json = JsonDocument.Parse(body);
        var member = Assert.Single(json.RootElement.EnumerateArray());
        // El id del propio miembro es el único id que viaja: es el del perfil /musicians/{userId}.
        Assert.Equal(
            new[] { "userId", "fullName", "role", "instruments", "city" }.Order(StringComparer.Ordinal),
            member.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
        Assert.Equal(400, member.GetProperty("userId").GetInt64());
        Assert.Equal("Mateo Ruiz", member.GetProperty("fullName").GetString());
        Assert.Equal("Manager", member.GetProperty("role").GetString());
        Assert.Equal("Bajo", member.GetProperty("instruments").GetString());
        Assert.Equal("Guadalajara, Jalisco", member.GetProperty("city").GetString());
    }

    [Fact]
    public async Task MiembroCerrado_ViajaSinInstrumentoNiCiudad()
    {
        // El perfil cerrado se decide en el camino de lectura; el endpoint solo no debe inventar nada.
        _mediator
            .SendQueryAsync<GetPublicGroupTeamQuery, GroupsResult<List<PublicGroupTeamMemberResponse>>>(Arg.Any<GetPublicGroupTeamQuery>())
            .Returns(GroupsResult<List<PublicGroupTeamMemberResponse>>.Success(
            [
                new PublicGroupTeamMemberResponse { UserId = 401, FullName = "Nadia Nava", Role = "Member", Instruments = null, City = null }
            ]));

        var response = await _client.GetAsync("api/groups/10/team/public");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var member = Assert.Single(json.RootElement.EnumerateArray());
        Assert.Equal("Nadia Nava", member.GetProperty("fullName").GetString());
        Assert.Equal("Member", member.GetProperty("role").GetString());
        Assert.Equal(JsonValueKind.Null, member.GetProperty("instruments").ValueKind);
        Assert.Equal(JsonValueKind.Null, member.GetProperty("city").ValueKind);
    }

    [Fact]
    public async Task EquipoVacio_DevuelveListaVacia()
    {
        _mediator
            .SendQueryAsync<GetPublicGroupTeamQuery, GroupsResult<List<PublicGroupTeamMemberResponse>>>(Arg.Any<GetPublicGroupTeamQuery>())
            .Returns(GroupsResult<List<PublicGroupTeamMemberResponse>>.Success([]));

        var response = await _client.GetAsync("api/groups/10/team/public");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task GrupoInexistente_Returns404()
    {
        _mediator
            .SendQueryAsync<GetPublicGroupTeamQuery, GroupsResult<List<PublicGroupTeamMemberResponse>>>(Arg.Any<GetPublicGroupTeamQuery>())
            .Returns(GroupsResult<List<PublicGroupTeamMemberResponse>>.NotFound("Grupo no encontrado."));

        var response = await _client.GetAsync($"api/groups/{MissingGroupId}/team/public");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
