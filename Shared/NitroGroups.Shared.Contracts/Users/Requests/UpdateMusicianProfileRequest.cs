namespace NitroGroups.Shared.Contracts.Users.Requests
{
    /// <summary>
    /// Body of <c>PUT api/musicians/me</c>. Every field is optional: null means "leave it as it
    /// is", so the form can send only what the musician changed. The account is never in the body;
    /// it comes from the token.
    /// </summary>
    public sealed class UpdateMusicianProfileRequest
    {
        public string? Headline { get; set; }
        public string? ShortBio { get; set; }
        public string? Instruments { get; set; }
        public int? YearsExperience { get; set; }
        public string? VideoUrl { get; set; }
        public bool? IsOpenToJoin { get; set; }
        public string? City { get; set; }
    }
}
