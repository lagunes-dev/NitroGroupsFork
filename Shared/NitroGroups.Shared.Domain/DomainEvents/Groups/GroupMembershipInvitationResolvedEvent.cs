using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Shared.Domain.DomainEvents.Groups
{
    /// <summary>
    /// Una invitación quedó resuelta: el músico la aceptó o la rechazó, o el grupo la retiró.
    /// El aviso va a la parte que no actuó.
    /// </summary>
    public class GroupMembershipInvitationResolvedEvent : IDomainEvent
    {
        public Guid EventId { get; set; } = Guid.NewGuid();
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public string EventType => nameof(GroupMembershipInvitationResolvedEvent);

        public long MembershipRequestId { get; set; }
        public long GroupId { get; set; }
        public long MusicianUserId { get; set; }
        public long ResolvedByUserId { get; set; }
        public MembershipRequestStatus NewStatus { get; set; }
    }
}
