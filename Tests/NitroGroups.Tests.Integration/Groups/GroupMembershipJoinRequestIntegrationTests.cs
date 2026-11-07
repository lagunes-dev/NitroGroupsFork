using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.List;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.RequestToJoin;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Respond;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// S1/S3/S4: pedir unirse, aceptar (alta del <see cref="GroupMember"/> activo con rol Member),
/// cancelar, y las dos bandejas.
/// </summary>
public class GroupMembershipJoinRequestIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;

    public GroupMembershipJoinRequestIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task MusicoPideUnirse_YElOwnerAcepta_CreaMiembroActivoConRolMember()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        // Cerrado a unirse: pedir unirse no depende de esa bandera (solo las invitaciones).
        var musicianId = await app.AddMusicianAsync("Ana", "López", openToJoin: false);

        var requested = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, "Quiero entrar"));

        Assert.True(requested.IsSuccess, requested.Error);
        Assert.Equal(MembershipDirection.Request, requested.Value!.Direction);
        Assert.Equal(musicianId, requested.Value.InitiatedByUserId);
        Assert.Equal(MembershipRequestStatus.Pending, requested.Value.Status);

        var accepted = await app.Respond(new RespondToMembershipRequestCommand(
            requested.Value.Id, GroupMembershipTestHarness.OwnerId, MembershipRequestDecision.Accept));

        Assert.True(accepted.IsSuccess, accepted.Error);
        Assert.Equal(MembershipRequestStatus.Accepted, accepted.Value!.Status);
        Assert.Equal(GroupMembershipTestHarness.OwnerId, accepted.Value.ResolvedByUserId);

        var member = Assert.Single(await app.MembersAsync(groupId));
        Assert.Equal(musicianId, member.UserId);
        Assert.True(member.IsActive);
        Assert.Equal(GroupMemberRole.Member, member.Role); // S3: nunca Manager
        Assert.Equal(JoinedVia.Request, member.JoinedVia);
        Assert.Equal((int)GroupMembershipTestHarness.OwnerId, member.ApprovedBy);
        Assert.Equal(GroupMembershipTestHarness.Now, member.JoinedAt);
        Assert.Null(member.LeftAt);

        var storedRequest = Assert.Single(await app.RequestsAsync());
        Assert.Equal(MembershipRequestStatus.Accepted, storedRequest.Status);
    }

    [Fact]
    public async Task UnManagerTambienPuedeAceptarLaSolicitud()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        await app.AddMemberAsync(groupId, GroupMembershipTestHarness.ManagerId, GroupMemberRole.Manager);

        var requested = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));
        var accepted = await app.Respond(new RespondToMembershipRequestCommand(
            requested.Value!.Id, GroupMembershipTestHarness.ManagerId, MembershipRequestDecision.Accept));

        Assert.True(accepted.IsSuccess, accepted.Error);
        var member = Assert.Single(await app.MembersAsync(groupId), m => m.UserId == musicianId);
        Assert.Equal((int)GroupMembershipTestHarness.ManagerId, member.ApprovedBy);
    }

    [Fact]
    public async Task SegundaSolicitudPendiente_EsConflicto_YVuelveASerPosibleTrasResolverla()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");

        var invited = await app.Invite(
            new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));
        Assert.True(invited.IsSuccess, invited.Error);

        // Mismo par, el otro sentido: sigue siendo una sola pendiente.
        var fromMusician = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));
        Assert.Equal(GroupsErrorKind.Conflict, fromMusician.ErrorKind);
        Assert.Single(await app.RequestsAsync());

        // El músico rechaza la invitación y ahora sí puede pedir unirse.
        var declined = await app.Respond(new RespondToMembershipRequestCommand(
            invited.Value!.Id, musicianId, MembershipRequestDecision.Decline));
        Assert.True(declined.IsSuccess, declined.Error);

        var afterResolution = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));
        Assert.True(afterResolution.IsSuccess, afterResolution.Error);
        Assert.Equal(2, (await app.RequestsAsync()).Count);
    }

    [Fact]
    public async Task Responder_ElMusicoNoPuedeAceptarSuPropiaSolicitud_EsForbidden()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        var requested = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));

        var result = await app.Respond(new RespondToMembershipRequestCommand(
            requested.Value!.Id, musicianId, MembershipRequestDecision.Accept));

        Assert.Equal(GroupsErrorKind.Forbidden, result.ErrorKind);
        Assert.Empty(await app.MembersAsync(groupId));
    }

    [Fact]
    public async Task Cancelar_SoloQuienLaInicio()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        await app.AddMemberAsync(groupId, GroupMembershipTestHarness.ManagerId, GroupMemberRole.Manager);

        var requested = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));

        // El manager administra el grupo, pero no inició esta solicitud.
        var byManager = await app.Respond(new RespondToMembershipRequestCommand(
            requested.Value!.Id, GroupMembershipTestHarness.ManagerId, MembershipRequestDecision.Cancel));
        Assert.Equal(GroupsErrorKind.Forbidden, byManager.ErrorKind);

        var byMusician = await app.Respond(new RespondToMembershipRequestCommand(
            requested.Value.Id, musicianId, MembershipRequestDecision.Cancel));
        Assert.True(byMusician.IsSuccess, byMusician.Error);
        Assert.Equal(MembershipRequestStatus.Cancelled, byMusician.Value!.Status);
        Assert.DoesNotContain(await app.MembersAsync(groupId), m => m.UserId == musicianId);
    }

    [Fact]
    public async Task PedirUnirse_SiendoCliente_EsForbidden()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var clientId = await app.AddUserAsync("Carla", "Cliente", UserType.Client);

        var result = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, clientId, null));

        Assert.Equal(GroupsErrorKind.Forbidden, result.ErrorKind);
        Assert.Empty(await app.RequestsAsync());
    }

    [Fact]
    public async Task PedirUnirse_YaSiendoMiembro_EsConflicto()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        await app.AddMemberAsync(groupId, musicianId, GroupMemberRole.Member);

        var result = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));

        Assert.Equal(GroupsErrorKind.Conflict, result.ErrorKind);
        Assert.Empty(await app.RequestsAsync());
    }

    [Fact]
    public async Task PedirUnirse_AGrupoInactivo_EsConflicto()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync(active: false);
        var musicianId = await app.AddMusicianAsync("Ana", "López");

        var result = await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));

        Assert.Equal(GroupsErrorKind.Conflict, result.ErrorKind);
        Assert.Empty(await app.RequestsAsync());
    }

    [Fact]
    public async Task MiBandeja_SoloDevuelveMisSolicitudes()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        var otherMusicianId = await app.AddMusicianAsync("Beto", "Ruiz");

        await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));
        await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, otherMusicianId, null));

        var mine = await app.MyRequests(new GetMyMembershipRequestsQuery(musicianId, null, null));

        Assert.True(mine.IsSuccess, mine.Error);
        var row = Assert.Single(mine.Value!);
        Assert.Equal(musicianId, row.MusicianUserId);
        Assert.Equal(MembershipDirection.Invitation, row.Direction);
        Assert.Equal("Ana López", row.MusicianName);
        Assert.Equal("Los Test", row.CounterpartName); // el músico ve el grupo como contraparte

        var pending = await app.MyRequests(
            new GetMyMembershipRequestsQuery(musicianId, null, MembershipRequestStatus.Pending));
        Assert.Single(pending.Value!);

        var accepted = await app.MyRequests(
            new GetMyMembershipRequestsQuery(musicianId, null, MembershipRequestStatus.Accepted));
        Assert.Empty(accepted.Value!);
    }

    [Fact]
    public async Task BandejaDelGrupo_ListaAmbosSentidos_ConElNombreDelMusico()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        var otherMusicianId = await app.AddMusicianAsync("Beto", "Ruiz");

        await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));
        await app.RequestToJoin(new RequestToJoinGroupCommand(groupId, otherMusicianId, "Quiero entrar"));

        var all = await app.GroupRequests(new GetGroupMembershipRequestsQuery(groupId, null, null));

        Assert.True(all.IsSuccess, all.Error);
        Assert.Equal(2, all.Value!.Count);
        Assert.All(all.Value, row => Assert.Equal(row.MusicianName, row.CounterpartName)); // el grupo ve al músico
        Assert.Contains(all.Value, row => row.Direction == MembershipDirection.Invitation && row.MusicianName == "Ana López");
        Assert.Contains(all.Value, row => row.Direction == MembershipDirection.Request
            && row.MusicianName == "Beto Ruiz"
            && row.Message == "Quiero entrar");

        var onlyRequests = await app.GroupRequests(
            new GetGroupMembershipRequestsQuery(groupId, MembershipDirection.Request, null));
        Assert.Single(onlyRequests.Value!);
    }
}

/// <summary>La mitad de "pedir unirse" y bandejas del arnés compartido.</summary>
internal sealed partial class GroupMembershipTestHarness
{
    internal Task<GroupsResult<GroupMembershipRequestResponse>> RequestToJoin(RequestToJoinGroupCommand command)
        => new RequestToJoinGroupCommandHandler(UnitOfWork, Users).Handle(command, CancellationToken.None);

    internal Task<GroupsResult<List<GroupMembershipRequestResponse>>> GroupRequests(GetGroupMembershipRequestsQuery query)
        => new GetGroupMembershipRequestsQueryHandler(UnitOfWork, Users).Handle(query, CancellationToken.None);

    internal Task<GroupsResult<List<GroupMembershipRequestResponse>>> MyRequests(GetMyMembershipRequestsQuery query)
        => new GetMyMembershipRequestsQueryHandler(UnitOfWork, Users).Handle(query, CancellationToken.None);
}
