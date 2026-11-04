namespace NitroGroups.Shared.Contracts.Users.Responses
{
    /// <summary>
    /// Resumen de un músico abierto a unirse a un grupo (S2). No incluye el email a propósito:
    /// un manager busca y invita por nombre, y el correo nunca sale del módulo Users.
    /// Es un tipo distinto de <c>UserSummary</c> para que la regla la garantice el tipo.
    /// </summary>
    public sealed record OpenMusicianSummary
    {
        public long UserId { get; init; }
        public string FullName { get; init; } = string.Empty;
        public string? ProfilePictureUrl { get; init; }
        public int YearsExperience { get; init; }
    }
}
