using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Respond;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// S1/S2/S3: invitar músicos, responder invitaciones y el alta del <see cref="GroupMember"/> al
/// aceptar (rol Member). Incluye la reactivación de una fila inactiva y la regla de una sola
/// solicitud pendiente por (grupo, músico).
/// </summary>
public class GroupMembershipInvitationIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;

    public GroupMembershipInvitationIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Invitar_MusicoAbierto_CreaSolicitudPendiente()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");

        var result = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, "Únete al grupo"));

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(MembershipDirection.Invitation, result.Value!.Direction);
        Assert.Equal(MembershipRequestStatus.Pending, result.Value.Status);
        Assert.Equal("Ana López", result.Value.MusicianName);
        Assert.Equal("Los Test", result.Value.GroupName);
        Assert.Equal("Ana López", result.Value.CounterpartName); // quien invita ve al músico

        var stored = Assert.Single(await app.RequestsAsync());
        Assert.Equal(groupId, stored.GroupId);
        Assert.Equal(musicianId, stored.MusicianUserId);
        Assert.Equal(GroupMembershipTestHarness.OwnerId, stored.InitiatedByUserId);
        Assert.Equal(MembershipDirection.Invitation, stored.Direction);
        Assert.Equal(MembershipRequestStatus.Pending, stored.Status);
        Assert.Equal("Únete al grupo", stored.Message);

        // Un pendiente no es un miembro: la lista pública de miembros no cambia.
        Assert.Empty(await app.MembersAsync(groupId));
    }

    [Fact]
    public async Task Invitar_Cliente_EsInvalido()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var clientId = await app.AddUserAsync("Carla", "Cliente", UserType.Client);

        var result = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, clientId, null));

        Assert.True(result.IsFailure);
        Assert.Equal(GroupsErrorKind.Validation, result.ErrorKind);
        Assert.Empty(await app.RequestsAsync());
    }

    [Fact]
    public async Task Invitar_MusicoCerradoAUnirse_EsConflicto()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Beto", "Cerrado", openToJoin: false);

        var result = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));

        Assert.True(result.IsFailure);
        Assert.Equal(GroupsErrorKind.Conflict, result.ErrorKind);
        Assert.Contains("no está abierto a unirse", result.Error);
        Assert.Empty(await app.RequestsAsync());
    }

    [Fact]
    public async Task Invitar_UsuarioInexistente_EsNotFound()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();

        var result = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, 404, null));

        Assert.Equal(GroupsErrorKind.NotFound, result.ErrorKind);
    }

    [Fact]
    public async Task Invitar_GrupoInactivo_EsConflicto()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync(active: false);
        var musicianId = await app.AddMusicianAsync("Ana", "López");

        var result = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));

        Assert.Equal(GroupsErrorKind.Conflict, result.ErrorKind);
        Assert.Empty(await app.RequestsAsync());
    }

    [Fact]
    public async Task Invitar_AUnMiembroActivo_EsConflicto()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        await app.AddMemberAsync(groupId, musicianId, GroupMemberRole.Member);

        var result = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));

        Assert.Equal(GroupsErrorKind.Conflict, result.ErrorKind);
        Assert.Contains("ya es miembro", result.Error);
        Assert.Empty(await app.RequestsAsync());
    }

    [Fact]
    public async Task AceptarUnaInvitacion_ElMusicoInvitadoEntraComoMember()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");

        var invited = await app.Invite(
            new InviteMusicianCommand(groupId, GroupMembershipTestHarness.ManagerId, musicianId, "Te queremos"));

        Assert.True(invited.IsSuccess, invited.Error);

        var accepted = await app.Respond(
            new RespondToMembershipRequestCommand(invited.Value!.Id, musicianId, MembershipRequestDecision.Accept));

        Assert.True(accepted.IsSuccess, accepted.Error);
        Assert.Equal(MembershipRequestStatus.Accepted, accepted.Value!.Status);
        Assert.Equal(musicianId, accepted.Value.ResolvedByUserId);
        Assert.Equal("Los Test", accepted.Value.CounterpartName); // el músico ve el grupo

        var member = Assert.Single(await app.MembersAsync(groupId));
        Assert.Equal(musicianId, member.UserId);
        Assert.True(member.IsActive);
        Assert.Equal(GroupMemberRole.Member, member.Role); // S3: nunca Manager
        Assert.Equal(JoinedVia.Invitation, member.JoinedVia);
        Assert.Equal((int)musicianId, member.ApprovedBy);
        Assert.Equal(GroupMembershipTestHarness.Now, member.JoinedAt);
        Assert.Null(member.LeftAt);
    }

    [Fact]
    public async Task AceptarUnaInvitacion_ReactivaLaFilaInactiva_EnLugarDeDuplicarla()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        await app.AddMemberAsync(
            groupId,
            musicianId,
            GroupMemberRole.Manager,
            active: false,
            leftAt: GroupMembershipTestHarness.Now.AddDays(-30));

        var invited = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));
        var accepted = await app.Respond(
            new RespondToMembershipRequestCommand(invited.Value!.Id, musicianId, MembershipRequestDecision.Accept));

        Assert.True(accepted.IsSuccess, accepted.Error);

        var member = Assert.Single(await app.MembersAsync(groupId)); // sigue habiendo una sola fila
        Assert.True(member.IsActive);
        Assert.Null(member.LeftAt);
        Assert.Equal(GroupMemberRole.Member, member.Role); // un Manager que salió vuelve como Member
        Assert.Equal(JoinedVia.Invitation, member.JoinedVia);
        Assert.Equal((int)musicianId, member.ApprovedBy);
        Assert.Equal(GroupMembershipTestHarness.Now, member.JoinedAt);
    }

    [Fact]
    public async Task ResponderDosVeces_EsConflicto()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        var invited = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));

        var first = await app.Respond(
            new RespondToMembershipRequestCommand(invited.Value!.Id, musicianId, MembershipRequestDecision.Decline));
        var second = await app.Respond(
            new RespondToMembershipRequestCommand(invited.Value!.Id, musicianId, MembershipRequestDecision.Accept));

        Assert.True(first.IsSuccess, first.Error);
        Assert.Equal(GroupsErrorKind.Conflict, second.ErrorKind);
        Assert.Empty(await app.MembersAsync(groupId));
    }

    [Fact]
    public async Task Responder_SinSerParte_EsNotFound()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        var invited = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));

        var accept = await app.Respond(new RespondToMembershipRequestCommand(
            invited.Value!.Id, GroupMembershipTestHarness.StrangerId, MembershipRequestDecision.Accept));
        var cancel = await app.Respond(new RespondToMembershipRequestCommand(
            invited.Value.Id, GroupMembershipTestHarness.StrangerId, MembershipRequestDecision.Cancel));

        Assert.Equal(GroupsErrorKind.NotFound, accept.ErrorKind);
        Assert.Equal(GroupsErrorKind.NotFound, cancel.ErrorKind);

        var stored = Assert.Single(await app.RequestsAsync());
        Assert.Equal(MembershipRequestStatus.Pending, stored.Status);
    }

    [Fact]
    public async Task Responder_ElGrupoNoPuedeAceptarSuPropiaInvitacion_EsForbidden()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var groupId = await app.AddGroupAsync();
        var musicianId = await app.AddMusicianAsync("Ana", "López");
        var invited = await app.Invite(new InviteMusicianCommand(groupId, GroupMembershipTestHarness.OwnerId, musicianId, null));

        var result = await app.Respond(new RespondToMembershipRequestCommand(
            invited.Value!.Id, GroupMembershipTestHarness.OwnerId, MembershipRequestDecision.Accept));

        Assert.Equal(GroupsErrorKind.Forbidden, result.ErrorKind);
        Assert.Empty(await app.MembersAsync(groupId));
    }
}
