using System.Net;
using System.Net.Http.Json;
using Cortex.Mediator;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.List;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.RequestToJoin;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Endpoints.Groups;

/// <summary>
/// Pedir unirse a un grupo y las dos bandejas (S1): privados, identidad desde el token y
/// ErrorKind traducido a código HTTP. Nunca se expone el email.
/// </summary>
public class MembershipJoinRequestsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999; // grupo que el usuario de test NO administra

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public MembershipJoinRequestsEndpointsTests(NitroGroupsWebAppFactory factory)
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

    private static GroupMembershipRequestResponse Pending(
        long id = 42,
        MembershipDirection direction = MembershipDirection.Request)
        => new()
        {
            Id = id,
            GroupId = 1,
            GroupName = "Los Vargas",
            MusicianUserId = 20,
            MusicianName = "Ana López",
            InitiatedByUserId = 20,
            Direction = direction,
            Status = MembershipRequestStatus.Pending,
            CounterpartName = direction == MembershipDirection.Invitation ? "Ana López" : "Los Vargas"
        };

    [Theory]
    [InlineData("POST", "api/groups/1/membership-requests")]
    [InlineData("GET", "api/groups/1/membership-requests")]
    [InlineData("GET", "api/membership-requests/mine")]
    public async Task SinToken_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("POST", "api/groups/1/membership-requests")]
    [InlineData("GET", "api/membership-requests/mine")]
    public async Task UsuarioSinSincronizar_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _unregistered.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PedirUnirse_SinBody_Returns201YLaIdentidadSaleDelToken()
    {
        _mediator
            .SendCommandAsync<RequestToJoinGroupCommand, GroupsResult<GroupMembershipRequestResponse>>(Arg.Any<RequestToJoinGroupCommand>())
            .Returns(GroupsResult<GroupMembershipRequestResponse>.Success(Pending()));

        var response = await _client.PostAsync("api/groups/1/membership-requests", null);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("api/membership-requests/42", response.Headers.Location?.OriginalString);
        await _mediator.Received().SendCommandAsync<RequestToJoinGroupCommand, GroupsResult<GroupMembershipRequestResponse>>(
            Arg.Is<RequestToJoinGroupCommand>(c => c.GroupId == 1
                && c.RequesterUserId == TestAuthHandler.UserId
                && c.Message == null));
    }

    [Fact]
    public async Task PedirUnirse_SiendoCliente_Returns403()
    {
        _mediator
            .SendCommandAsync<RequestToJoinGroupCommand, GroupsResult<GroupMembershipRequestResponse>>(Arg.Any<RequestToJoinGroupCommand>())
            .Returns(GroupsResult<GroupMembershipRequestResponse>.Forbidden(
                "Solo los músicos pueden pedir unirse a un grupo."));

        var response = await _client.PostAsJsonAsync("api/groups/1/membership-requests", new { message = "Hola" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PedirUnirse_MensajeDemasiadoLargo_Returns400()
    {
        var response = await _client.PostAsJsonAsync(
            "api/groups/1/membership-requests",
            new { message = new string('x', 2001) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PedirUnirse_ConflictoDelCasoDeUso_Returns409()
    {
        _mediator
            .SendCommandAsync<RequestToJoinGroupCommand, GroupsResult<GroupMembershipRequestResponse>>(Arg.Any<RequestToJoinGroupCommand>())
            .Returns(GroupsResult<GroupMembershipRequestResponse>.Conflict(
                "Ya hay una solicitud pendiente entre este grupo y este músico."));

        var response = await _client.PostAsync("api/groups/1/membership-requests", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task BandejaDelGrupo_PasaDireccionYEstado()
    {
        _mediator
            .SendQueryAsync<GetGroupMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
                Arg.Any<GetGroupMembershipRequestsQuery>())
            .Returns(GroupsResult<List<GroupMembershipRequestResponse>>.Success([Pending()]));

        var response = await _client.GetAsync("api/groups/1/membership-requests?direction=Request&status=Pending");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rows = await response.Content.ReadFromJsonAsync<List<GroupMembershipRequestResponse>>(ApiJsonOptions.Default);
        Assert.Equal("Ana López", Assert.Single(rows!).MusicianName);

        await _mediator.Received().SendQueryAsync<GetGroupMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
            Arg.Is<GetGroupMembershipRequestsQuery>(q => q.GroupId == 1
                && q.Direction == MembershipDirection.Request
                && q.Status == MembershipRequestStatus.Pending));
    }

    [Fact]
    public async Task BandejaDelGrupo_GrupoAjeno_Returns403()
    {
        var response = await _client.GetAsync($"api/groups/{ForeignGroupId}/membership-requests");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendQueryAsync<GetGroupMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
            Arg.Is<GetGroupMembershipRequestsQuery>(q => q.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task MiBandeja_UsaElUsuarioDelToken()
    {
        _mediator
            .SendQueryAsync<GetMyMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
                Arg.Any<GetMyMembershipRequestsQuery>())
            .Returns(GroupsResult<List<GroupMembershipRequestResponse>>.Success([]));

        var response = await _client.GetAsync("api/membership-requests/mine?status=Pending");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetMyMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
            Arg.Is<GetMyMembershipRequestsQuery>(q => q.MusicianUserId == TestAuthHandler.UserId
                && q.Status == MembershipRequestStatus.Pending));
    }

    [Fact]
    public async Task LasRespuestasNoExponenEmail()
    {
        _mediator
            .SendQueryAsync<GetMyMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
                Arg.Any<GetMyMembershipRequestsQuery>())
            .Returns(GroupsResult<List<GroupMembershipRequestResponse>>.Success([Pending()]));

        var raw = await _client.GetStringAsync("api/membership-requests/mine");

        Assert.DoesNotContain("email", raw, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Ana López", raw);
    }
}
