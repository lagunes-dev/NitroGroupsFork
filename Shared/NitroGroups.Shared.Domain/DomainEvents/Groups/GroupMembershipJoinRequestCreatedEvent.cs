namespace NitroGroups.Shared.Domain.DomainEvents.Groups
{
    /// <summary>
    /// Un músico pidió unirse a un grupo (S1). El aviso va al Owner y a los Managers activos; el
    /// texto que el músico escribió no viaja en el evento: queda solo en la base.
    /// </summary>
    public class GroupMembershipJoinRequestCreatedEvent : IDomainEvent
    {
        public Guid EventId { get; set; } = Guid.NewGuid();
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public string EventType => nameof(GroupMembershipJoinRequestCreatedEvent);

        public long MembershipRequestId { get; set; }
        public long GroupId { get; set; }
        public long MusicianUserId { get; set; }
        public long RequestedByUserId { get; set; }
    }
}
