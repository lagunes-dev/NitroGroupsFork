using Cortex.Mediator.Notifications;
using NitroGroups.Core.Groups.Application.Events;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.EventHandlers;

// Los handlers corren desde el outbox. Si un envío falla, la excepción hace que el outbox
// reintente el evento más tarde. Los emails no incluyen el texto del mensaje (queda en la
// plataforma) ni la dirección de nadie: solo el nombre del grupo o del músico.

/// <summary>Invitación nueva: avisa al músico invitado.</summary>
public sealed class GroupMembershipInvitationCreatedEmailHandler(
    GroupMembershipEmailRecipients recipients,
    IEmailSender email) : INotificationHandler<GroupMembershipEvents.GroupMembershipInvitationCreatedEvent>
{
    public async Task Handle(
        GroupMembershipEvents.GroupMembershipInvitationCreatedEvent notification,
        CancellationToken cancellationToken)
    {
        var groupName = await recipients.GroupNameAsync(notification.GroupId, cancellationToken);
        var to = await recipients.MusicianAsync(notification.MusicianUserId, cancellationToken);

        var subject = $"{groupName} te invitó a unirte";
        var body = $"El grupo {groupName} te invitó a unirte como miembro.\nEntra a NitroGroups para aceptar o rechazar.";

        foreach (var address in to)
            await email.SendAsync(address, subject, body, cancellationToken);
    }
}

/// <summary>Solicitud nueva: avisa al Owner y a los Managers activos del grupo.</summary>
public sealed class GroupMembershipJoinRequestCreatedEmailHandler(
    GroupMembershipEmailRecipients recipients,
    IEmailSender email) : INotificationHandler<GroupMembershipEvents.GroupMembershipJoinRequestCreatedEvent>
{
    public async Task Handle(
        GroupMembershipEvents.GroupMembershipJoinRequestCreatedEvent notification,
        CancellationToken cancellationToken)
    {
        var groupName = await recipients.GroupNameAsync(notification.GroupId, cancellationToken);
        var to = await recipients.GroupManagersAsync(notification.GroupId, cancellationToken);

        var subject = $"Nueva solicitud para unirse a {groupName}";
        var body = $"Un músico pidió unirse a {groupName}.\nEntra a NitroGroups para revisarla y responder.";

        foreach (var address in to)
            await email.SendAsync(address, subject, body, cancellationToken);
    }
}

/// <summary>Invitación resuelta: avisa a la parte que no actuó.</summary>
public sealed class GroupMembershipInvitationResolvedEmailHandler(
    GroupMembershipEmailRecipients recipients,
    IEmailSender email) : INotificationHandler<GroupMembershipEvents.GroupMembershipInvitationResolvedEvent>
{
    public async Task Handle(
        GroupMembershipEvents.GroupMembershipInvitationResolvedEvent notification,
        CancellationToken cancellationToken)
    {
        var groupName = await recipients.GroupNameAsync(notification.GroupId, cancellationToken);

        IReadOnlyList<string> to;
        string subject;
        if (notification.NewStatus == MembershipRequestStatus.Cancelled)
        {
            // La retiró el grupo: el aviso es para el músico invitado.
            to = await recipients.MusicianAsync(notification.MusicianUserId, cancellationToken);
            subject = $"{groupName} canceló su invitación para unirte";
        }
        else
        {
            // La respondió el músico: el aviso es para el grupo.
            var musicianName = await recipients.MusicianNameAsync(notification.MusicianUserId, cancellationToken);
            to = await recipients.GroupManagersAsync(notification.GroupId, cancellationToken);
            subject = notification.NewStatus == MembershipRequestStatus.Accepted
                ? $"{musicianName} aceptó tu invitación a {groupName}"
                : $"{musicianName} rechazó tu invitación a {groupName}";
        }

        var body = $"{subject}.\nEntra a NitroGroups para ver el detalle.";
        foreach (var address in to)
            await email.SendAsync(address, subject, body, cancellationToken);
    }
}

/// <summary>Solicitud resuelta: avisa a la parte que no actuó.</summary>
public sealed class GroupMembershipJoinRequestResolvedEmailHandler(
    GroupMembershipEmailRecipients recipients,
    IEmailSender email) : INotificationHandler<GroupMembershipEvents.GroupMembershipJoinRequestResolvedEvent>
{
    public async Task Handle(
        GroupMembershipEvents.GroupMembershipJoinRequestResolvedEvent notification,
        CancellationToken cancellationToken)
    {
        var groupName = await recipients.GroupNameAsync(notification.GroupId, cancellationToken);

        IReadOnlyList<string> to;
        string subject;
        if (notification.NewStatus == MembershipRequestStatus.Cancelled)
        {
            // La retiró el músico: el aviso es para el grupo.
            var musicianName = await recipients.MusicianNameAsync(notification.MusicianUserId, cancellationToken);
            to = await recipients.GroupManagersAsync(notification.GroupId, cancellationToken);
            subject = $"{musicianName} canceló su solicitud para unirse a {groupName}";
        }
        else
        {
            // La respondió el grupo: el aviso es para el músico que la pidió.
            to = await recipients.MusicianAsync(notification.MusicianUserId, cancellationToken);
            subject = notification.NewStatus == MembershipRequestStatus.Accepted
                ? $"{groupName} aceptó tu solicitud para unirte"
                : $"{groupName} rechazó tu solicitud para unirte";
        }

        var body = $"{subject}.\nEntra a NitroGroups para ver el detalle.";
        foreach (var address in to)
            await email.SendAsync(address, subject, body, cancellationToken);
    }
}
