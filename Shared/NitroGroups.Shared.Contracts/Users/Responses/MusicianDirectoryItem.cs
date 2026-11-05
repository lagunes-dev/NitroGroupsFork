namespace NitroGroups.Shared.Contracts.Users.Responses
{
    /// <summary>
    /// One entry of the public musician directory (<c>GET api/musicians</c>). Like
    /// <see cref="OpenMusicianSummary"/> it has no email on purpose: the directory is anonymous.
    /// </summary>
    public sealed record MusicianDirectoryItem
    {
        public long UserId { get; init; }
        public string FullName { get; init; } = string.Empty;
        public string? Headline { get; init; }
        public string? Instruments { get; init; }
        public string? City { get; init; }
        public int YearsExperience { get; init; }
        public string? ProfilePictureUrl { get; init; }
    }
}
