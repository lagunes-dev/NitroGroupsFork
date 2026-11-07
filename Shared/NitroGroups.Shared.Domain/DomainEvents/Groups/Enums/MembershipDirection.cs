namespace NitroGroups.Shared.Domain.DomainEvents.Groups.Enums
{
    /// <summary>
    /// Who started a membership request. Stored as an integer: do not reorder or reuse values.
    /// </summary>
    public enum MembershipDirection
    {
        /// <summary>A group manager invites a musician.</summary>
        Invitation = 0,

        /// <summary>A musician asks to join a group.</summary>
        Request = 1
    }
}
