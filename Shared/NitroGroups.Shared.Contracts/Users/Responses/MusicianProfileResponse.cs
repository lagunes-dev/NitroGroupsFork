using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Shared.Contracts.Users.Responses
{
    /// <summary>
    /// Public profile of a musician: what a group needs to decide whether to invite them, plus the
    /// groups they play in. It is the exact object of <c>GET api/musicians/{userId:long}</c> and of
    /// the musician's own update, so both always return the same shape.
    /// </summary>
    public sealed class MusicianProfileResponse
    {
        public long UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? Headline { get; set; }
        public string? ShortBio { get; set; }
        public string? Instruments { get; set; }
        public int YearsExperience { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string? VideoUrl { get; set; }
        public bool IsOpenToJoin { get; set; }

        /// <summary>
        /// Active memberships only, ordered Owner, Manager, Member and then the oldest membership
        /// first (the order the Groups module returns).
        /// </summary>
        public IReadOnlyList<MusicianProfileGroup> Groups { get; set; } = [];
    }

    /// <summary>One group the musician plays in, with their role in it.</summary>
    public sealed class MusicianProfileGroup
    {
        public long GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public GroupMemberRole Role { get; set; }
    }
}
