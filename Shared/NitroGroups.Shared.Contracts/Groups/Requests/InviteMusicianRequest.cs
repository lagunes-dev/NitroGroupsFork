namespace NitroGroups.Shared.Contracts.Groups.Requests
{
    /// <summary>Un manager invita a un músico a su grupo (S1). Quien invita es siempre el usuario del token.</summary>
    public class InviteMusicianRequest
    {
        public long MusicianUserId { get; set; }

        /// <summary>Nota opcional para el músico.</summary>
        public string? Message { get; set; }
    }
}
