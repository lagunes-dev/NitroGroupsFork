using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cortex.Mediator;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.GetMine;
using NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.Record;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Endpoints.Groups;

/// <summary>
/// S9: un manager que abre el perfil de un músico deja una visita, y el músico ve cuántos grupos
/// lo miraron. Los dos endpoints son privados: el grupo sale de la ruta, el músico visitado de la
/// ruta y el visitante del token (nada del cuerpo se toma en cuenta).
/// </summary>
public class ProfileVisitEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long PlainMemberGroupId = 11; // el usuario de test es solo Member de este grupo
    private const long ForeignGroupId = 999;    // grupo que el usuario de test NO administra

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public ProfileVisitEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule
            .CanManageGroupAsync(PlainMemberGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(false);
        factory.GroupsModule
            .CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(false);
    }

    [Theory]
    [InlineData("POST", "api/groups/1/profile-visits/20")]
    [InlineData("GET", "api/me/profile-visits")]
    public async Task SinToken_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.GetAsync("api/me/profile-visits");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Visita_SinAdministrarElGrupo_Returns403_YNoSeRegistra()
    {
        // El usuario pertenece al grupo, pero como Member no lo administra.
        var member = await _client.PostAsync($"api/groups/{PlainMemberGroupId}/profile-visits/20", null);
        var foreign = await _client.PostAsync($"api/groups/{ForeignGroupId}/profile-visits/20", null);

        Assert.Equal(HttpStatusCode.Forbidden, member.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, foreign.StatusCode);
        // El mock del mediador es compartido por la clase: se mira solo por estos grupos.
        await _mediator.DidNotReceive().SendCommandAsync<RecordProfileVisitCommand, GroupsResult<bool>>(
            Arg.Is<RecordProfileVisitCommand>(c => c.GroupId == PlainMemberGroupId || c.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task Visita_TomaElGrupoYElMusicoDeLaRuta_YElVisitanteDelToken()
    {
        _mediator
            .SendCommandAsync<RecordProfileVisitCommand, GroupsResult<bool>>(Arg.Any<RecordProfileVisitCommand>())
            .Returns(GroupsResult<bool>.Success(true));

        // Todo lo del cuerpo es inventado: ni el grupo, ni el visitante, ni el músico salen de ahí.
        var response = await _client.PostAsJsonAsync(
            "api/groups/1/profile-visits/20",
            new { groupId = 999, musicianUserId = 555, viewerUserId = 777, visitedAt = "2020-01-01T00:00:00Z" });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await _mediator.Received().SendCommandAsync<RecordProfileVisitCommand, GroupsResult<bool>>(
            Arg.Is<RecordProfileVisitCommand>(c => c.GroupId == 1
                && c.MusicianUserId == 20
                && c.ViewerUserId == TestAuthHandler.UserId));
        await _mediator.DidNotReceive().SendCommandAsync<RecordProfileVisitCommand, GroupsResult<bool>>(
            Arg.Is<RecordProfileVisitCommand>(c => c.GroupId == 999 || c.MusicianUserId == 555 || c.ViewerUserId == 777));
    }

    [Fact]
    public async Task Visita_AutoVisita_Returns400ConMensajeEnEspanol()
    {
        _mediator
            .SendCommandAsync<RecordProfileVisitCommand, GroupsResult<bool>>(Arg.Any<RecordProfileVisitCommand>())
            .Returns(GroupsResult<bool>.Validation("No puedes registrar una visita a tu propio perfil."));

        var response = await _client.PostAsync($"api/groups/1/profile-visits/{TestAuthHandler.UserId}", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("tu propio perfil", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Musico_LeeSuConteoYLosGruposQueLoMiraron()
    {
        _mediator
            .SendQueryAsync<GetMyProfileVisitsQuery, GroupsResult<ProfileVisitsResponse>>(Arg.Any<GetMyProfileVisitsQuery>())
            .Returns(GroupsResult<ProfileVisitsResponse>.Success(new ProfileVisitsResponse
            {
                Count = 2,
                Groups =
                [
                    new ProfileVisitGroupResponse
                    {
                        Id = 7,
                        GroupName = "Los Vargas",
                        Slug = "los-vargas",
                        LastVisitedAt = new DateTime(2026, 11, 5, 18, 0, 0, DateTimeKind.Utc)
                    },
                    new ProfileVisitGroupResponse
                    {
                        Id = 3,
                        GroupName = "Mariachi Oro",
                        Slug = "mariachi-oro",
                        LastVisitedAt = new DateTime(2026, 11, 4, 18, 0, 0, DateTimeKind.Utc)
                    }
                ]
            }));

        var response = await _client.GetAsync("api/me/profile-visits");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetMyProfileVisitsQuery, GroupsResult<ProfileVisitsResponse>>(
            Arg.Is<GetMyProfileVisitsQuery>(q => q.MusicianUserId == TestAuthHandler.UserId));

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("@", body); // el aviso nunca lleva emails
        using var json = JsonDocument.Parse(body);
        Assert.Equal(2, json.RootElement.GetProperty("count").GetInt32());
        var groups = json.RootElement.GetProperty("groups").EnumerateArray().ToList();
        // Los más nuevos primero, con lo justo para enlazar al perfil público del grupo.
        Assert.Equal(
            new[] { "id", "groupName", "slug", "lastVisitedAt" }.Order(StringComparer.Ordinal),
            groups[0].EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
        Assert.Equal(7, groups[0].GetProperty("id").GetInt64());
        Assert.Equal("Los Vargas", groups[0].GetProperty("groupName").GetString());
        Assert.Equal("los-vargas", groups[0].GetProperty("slug").GetString());
        Assert.Equal(3, groups[1].GetProperty("id").GetInt64());
    }

    [Fact]
    public async Task Musico_SinVisitas_DevuelveCeroYListaVacia()
    {
        _mediator
            .SendQueryAsync<GetMyProfileVisitsQuery, GroupsResult<ProfileVisitsResponse>>(Arg.Any<GetMyProfileVisitsQuery>())
            .Returns(GroupsResult<ProfileVisitsResponse>.Success(new ProfileVisitsResponse()));

        var response = await _client.GetAsync("api/me/profile-visits");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(0, json.RootElement.GetProperty("count").GetInt32());
        Assert.Empty(json.RootElement.GetProperty("groups").EnumerateArray());
    }
}
