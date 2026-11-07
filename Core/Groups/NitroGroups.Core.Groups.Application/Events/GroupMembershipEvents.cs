using Cortex.Mediator.Notifications;

namespace NitroGroups.Core.Groups.Application.Events;

/// <summary>
/// Versiones INotification de los avisos de membresía: el outbox deserializa a estos tipos
/// (ver <c>EventProvider</c>, que los busca por el nombre de la clase base).
/// </summary>
public class GroupMembershipEvents
{
    public class GroupMembershipInvitationCreatedEvent
        : Shared.Domain.DomainEvents.Groups.GroupMembershipInvitationCreatedEvent, INotification;

    public class GroupMembershipJoinRequestCreatedEvent
        : Shared.Domain.DomainEvents.Groups.GroupMembershipJoinRequestCreatedEvent, INotification;

    public class GroupMembershipInvitationResolvedEvent
        : Shared.Domain.DomainEvents.Groups.GroupMembershipInvitationResolvedEvent, INotification;

    public class GroupMembershipJoinRequestResolvedEvent
        : Shared.Domain.DomainEvents.Groups.GroupMembershipJoinRequestResolvedEvent, INotification;
}
