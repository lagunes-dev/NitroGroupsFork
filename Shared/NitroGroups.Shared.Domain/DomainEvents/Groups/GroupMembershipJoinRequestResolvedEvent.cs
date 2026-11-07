using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Shared.Domain.DomainEvents.Groups
{
    /// <summary>
    /// Una solicitud para unirse quedó resuelta: el grupo la aceptó o la rechazó, o el músico la
    /// retiró. El aviso va a la parte que no actuó.
    /// </summary>
    public class GroupMembershipJoinRequestResolvedEvent : IDomainEvent
    {
        public Guid EventId { get; set; } = Guid.NewGuid();
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public string EventType => nameof(GroupMembershipJoinRequestResolvedEvent);

        public long MembershipRequestId { get; set; }
        public long GroupId { get; set; }
        public long MusicianUserId { get; set; }
        public long ResolvedByUserId { get; set; }
        public MembershipRequestStatus NewStatus { get; set; }
    }
}
