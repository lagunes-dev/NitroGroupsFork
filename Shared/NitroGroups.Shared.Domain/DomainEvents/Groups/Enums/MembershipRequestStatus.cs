namespace NitroGroups.Shared.Domain.DomainEvents.Groups.Enums
{
    /// <summary>
    /// Status of a group membership request. Stored as an integer: do not reorder or reuse values.
    /// </summary>
    public enum MembershipRequestStatus
    {
        Pending = 0,
        Accepted = 1,
        Declined = 2,
        Cancelled = 3
    }
}
