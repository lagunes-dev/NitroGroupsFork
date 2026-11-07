namespace NitroGroups.Shared.Domain.DomainEvents.Groups
{
    /// <summary>
    /// Un manager invitó a un músico a su grupo (S1). El aviso va al músico invitado; el texto que
    /// el manager escribió no viaja en el evento: queda solo en la base.
    /// </summary>
    public class GroupMembershipInvitationCreatedEvent : IDomainEvent
    {
        public Guid EventId { get; set; } = Guid.NewGuid();
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public string EventType => nameof(GroupMembershipInvitationCreatedEvent);

        public long MembershipRequestId { get; set; }
        public long GroupId { get; set; }
        public long MusicianUserId { get; set; }
        public long InvitedByUserId { get; set; }
    }
}
