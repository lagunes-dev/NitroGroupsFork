using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cortex.Mediator;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Respond;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Endpoints.Groups;

/// <summary>
/// Invitar músicos y responder (aceptar/rechazar/cancelar) una invitación o solicitud (S1):
/// endpoints privados, identidad desde el token y ErrorKind traducido a código HTTP.
/// </summary>
public class MembershipInvitationsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999; // grupo que el usuario de test NO administra

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public MembershipInvitationsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule
            .CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(false);
    }

    private static GroupMembershipRequestResponse Pending(long id = 42)
        => new()
        {
            Id = id,
            GroupId = 1,
            GroupName = "Los Vargas",
            MusicianUserId = 20,
            MusicianName = "Ana López",
            InitiatedByUserId = 10,
            Direction = MembershipDirection.Invitation,
            Status = MembershipRequestStatus.Pending,
            CounterpartName = "Ana López"
        };

    private static GroupsResult<GroupMembershipRequestResponse> Ok(long id = 42)
        => GroupsResult<GroupMembershipRequestResponse>.Success(Pending(id));

    [Theory]
    [InlineData("POST", "api/groups/1/membership-invitations")]
    [InlineData("POST", "api/membership-requests/1/accept")]
    [InlineData("POST", "api/membership-requests/1/decline")]
    [InlineData("POST", "api/membership-requests/1/cancel")]
    public async Task SinToken_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.PostAsync("api/membership-requests/1/accept", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Invitar_Musico_Returns201ConUbicacion()
    {
        _mediator
            .SendCommandAsync<InviteMusicianCommand, GroupsResult<GroupMembershipRequestResponse>>(Arg.Any<InviteMusicianCommand>())
            .Returns(Ok());

        var response = await _client.PostAsJsonAsync(
            "api/groups/1/membership-invitations",
            new { musicianUserId = 20, message = "Únete" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("api/membership-requests/42", response.Headers.Location?.OriginalString);
        var body = await response.Content.ReadFromJsonAsync<GroupMembershipRequestResponse>(ApiJsonOptions.Default);
        Assert.Equal(MembershipRequestStatus.Pending, body!.Status);
        Assert.Equal("Ana López", body.MusicianName);
    }

    [Fact]
    public async Task Invitar_LaIdentidadSaleDelToken_NoDelBody()
    {
        _mediator
            .SendCommandAsync<InviteMusicianCommand, GroupsResult<GroupMembershipRequestResponse>>(Arg.Any<InviteMusicianCommand>())
            .Returns(Ok());

        await _client.PostAsJsonAsync(
            "api/groups/1/membership-invitations",
            new { musicianUserId = 20, invitedByUserId = 777, message = "Únete" });

        await _mediator.Received().SendCommandAsync<InviteMusicianCommand, GroupsResult<GroupMembershipRequestResponse>>(
            Arg.Is<InviteMusicianCommand>(c => c.GroupId == 1
                && c.InvitedByUserId == TestAuthHandler.UserId
                && c.MusicianUserId == 20
                && c.Message == "Únete"));
        await _mediator.DidNotReceive().SendCommandAsync<InviteMusicianCommand, GroupsResult<GroupMembershipRequestResponse>>(
            Arg.Is<InviteMusicianCommand>(c => c.InvitedByUserId == 777));
    }

    [Fact]
    public async Task Invitar_SinMusico_Returns400()
    {
        var response = await _client.PostAsJsonAsync("api/groups/1/membership-invitations", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(problem.RootElement.GetProperty("errors").TryGetProperty("MusicianUserId", out _));
    }

    [Fact]
    public async Task Invitar_GrupoAjeno_Returns403()
    {
        var response = await _client.PostAsJsonAsync(
            $"api/groups/{ForeignGroupId}/membership-invitations",
            new { musicianUserId = 20 });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Invitar_YaHayUnaPendiente_Returns409ConMensajeEnEspanol()
    {
        _mediator
            .SendCommandAsync<InviteMusicianCommand, GroupsResult<GroupMembershipRequestResponse>>(Arg.Any<InviteMusicianCommand>())
            .Returns(GroupsResult<GroupMembershipRequestResponse>.Conflict(
                "Ya hay una solicitud pendiente entre este grupo y este músico."));

        var response = await _client.PostAsJsonAsync("api/groups/1/membership-invitations", new { musicianUserId = 20 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("Ya hay una solicitud pendiente", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("accept", MembershipRequestDecision.Accept)]
    [InlineData("decline", MembershipRequestDecision.Decline)]
    [InlineData("cancel", MembershipRequestDecision.Cancel)]
    public async Task Responder_UsaElUsuarioDelToken(string action, MembershipRequestDecision decision)
    {
        _mediator
            .SendCommandAsync<RespondToMembershipRequestCommand, GroupsResult<GroupMembershipRequestResponse>>(
                Arg.Any<RespondToMembershipRequestCommand>())
            .Returns(Ok(7));

        var response = await _client.PostAsync($"api/membership-requests/7/{action}", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendCommandAsync<RespondToMembershipRequestCommand, GroupsResult<GroupMembershipRequestResponse>>(
            Arg.Is<RespondToMembershipRequestCommand>(c => c.Id == 7
                && c.UserId == TestAuthHandler.UserId
                && c.Decision == decision));
    }

    [Fact]
    public async Task Responder_SinSerParte_Returns404()
    {
        _mediator
            .SendCommandAsync<RespondToMembershipRequestCommand, GroupsResult<GroupMembershipRequestResponse>>(
                Arg.Is<RespondToMembershipRequestCommand>(c => c.Id == 404))
            .Returns(GroupsResult<GroupMembershipRequestResponse>.NotFound("Solicitud no encontrada."));

        var response = await _client.PostAsync("api/membership-requests/404/accept", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Responder_ParticipanteSinElPapelCorrecto_Returns403()
    {
        _mediator
            .SendCommandAsync<RespondToMembershipRequestCommand, GroupsResult<GroupMembershipRequestResponse>>(
                Arg.Is<RespondToMembershipRequestCommand>(c => c.Id == 12))
            .Returns(GroupsResult<GroupMembershipRequestResponse>.Forbidden("Solo el músico invitado puede responder la invitación."));

        var response = await _client.PostAsync("api/membership-requests/12/accept", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Responder_TransicionInvalida_Returns409()
    {
        _mediator
            .SendCommandAsync<RespondToMembershipRequestCommand, GroupsResult<GroupMembershipRequestResponse>>(
                Arg.Is<RespondToMembershipRequestCommand>(c => c.Id == 8))
            .Returns(GroupsResult<GroupMembershipRequestResponse>.Conflict(
                "Only a pending request can be accepted; this one is accepted."));

        var response = await _client.PostAsync("api/membership-requests/8/accept", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }
}
