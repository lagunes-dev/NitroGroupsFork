using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Shared.Contracts.Groups.Responses
{
    /// <summary>An active membership of the current user, with enough of the group to link to its profile.</summary>
    public class GroupMembershipSummary
    {
        public long GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? ProfilePictureUrl { get; set; }
        public GroupMemberRole Role { get; set; }
        public DateTime JoinedAt { get; set; }
    }
}
