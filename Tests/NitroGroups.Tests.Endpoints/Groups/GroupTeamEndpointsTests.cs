using Cortex.Mediator;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetTeam;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Groups;

/// <summary>
/// Panel del manager: <c>GET api/groups/{groupId}/team</c> exige Owner/Manager del grupo y devuelve
/// el equipo activo con nombre y rol, sin emails. Nadie más puede leerlo.
/// </summary>
public class GroupTeamEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long PlainMemberGroupId = 11; // el usuario de test es solo Member de este grupo
    private const long ForeignGroupId = 999;    // grupo que el usuario de test NO administra
    private const long MissingGroupId = 998;    // grupo que no existe

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public GroupTeamEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.CanManageGroupAsync(PlainMemberGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
        factory.GroupsModule.CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
        factory.GroupsModule.GroupExistsAsync(MissingGroupId, Arg.Any<CancellationToken>()).Returns(false);
    }

    [Fact]
    public async Task SinToken_Returns401()
    {
        var response = await _anonymous.GetAsync("api/groups/1/team");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.GetAsync("api/groups/1/team");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MiembroSinRol_Returns403()
    {
        // El grupo existe y el llamante pertenece a él, pero como Member no administra.
        var response = await _client.GetAsync($"api/groups/{PlainMemberGroupId}/team");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendQueryAsync<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>(
            Arg.Is<GetGroupTeamQuery>(q => q.GroupId == PlainMemberGroupId));
    }

    [Fact]
    public async Task ManagerDeOtroGrupo_Returns403()
    {
        var response = await _client.GetAsync($"api/groups/{ForeignGroupId}/team");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendQueryAsync<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>(
            Arg.Is<GetGroupTeamQuery>(q => q.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task GrupoInexistente_Returns404()
    {
        var response = await _client.GetAsync($"api/groups/{MissingGroupId}/team");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await _mediator.DidNotReceive().SendQueryAsync<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>(
            Arg.Is<GetGroupTeamQuery>(q => q.GroupId == MissingGroupId));
    }

    [Fact]
    public async Task Manager_VeElEquipoConNombresYRoles_SinEmail()
    {
        _mediator
            .SendQueryAsync<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>(Arg.Any<GetGroupTeamQuery>())
            .Returns(GroupsResult<List<GroupTeamMemberResponse>>.Success(
            [
                new GroupTeamMemberResponse
                {
                    UserId = 400,
                    FullName = "Mateo Ruiz",
                    Role = "Manager",
                    ProfilePictureUrl = null,
                    JoinedAt = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc)
                }
            ]));

        var response = await _client.GetAsync("api/groups/10/team");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>(
            Arg.Is<GetGroupTeamQuery>(q => q.GroupId == 10));

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("@", body); // nunca emails
        using var json = JsonDocument.Parse(body);
        var member = Assert.Single(json.RootElement.EnumerateArray());
        // El orden de las propiedades de un objeto JSON no importa; el conjunto sí.
        Assert.Equal(
            new[] { "userId", "fullName", "role", "profilePictureUrl", "joinedAt" }.Order(StringComparer.Ordinal),
            member.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
        // Mismo id que usa el perfil público del músico (/musicians/{userId}).
        Assert.Equal(400, member.GetProperty("userId").GetInt64());
        Assert.Equal("Mateo Ruiz", member.GetProperty("fullName").GetString());
        Assert.Equal("Manager", member.GetProperty("role").GetString());
        Assert.Equal(JsonValueKind.Null, member.GetProperty("profilePictureUrl").ValueKind);
        Assert.Equal(
            new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc),
            member.GetProperty("joinedAt").GetDateTime().ToUniversalTime());
    }

    [Fact]
    public async Task EquipoVacio_DevuelveListaVacia()
    {
        _mediator
            .SendQueryAsync<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>(Arg.Any<GetGroupTeamQuery>())
            .Returns(GroupsResult<List<GroupTeamMemberResponse>>.Success([]));

        var response = await _client.GetAsync("api/groups/10/team");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }
}
