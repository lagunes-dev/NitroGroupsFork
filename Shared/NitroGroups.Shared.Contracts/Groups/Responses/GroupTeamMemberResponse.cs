namespace NitroGroups.Shared.Contracts.Groups.Responses
{
    /// <summary>
    /// Un miembro activo del equipo de un grupo, con el nombre que el manager reconoce.
    /// <see cref="UserId"/> es también el id del perfil público del músico (<c>/musicians/{userId}</c>),
    /// así que no hace falta otro campo para enlazarlo. Nunca lleva email.
    /// </summary>
    public sealed class GroupTeamMemberResponse
    {
        public long UserId { get; set; }

        /// <summary>"Nombre Apellido"; si el nombre está vacío, la parte local de su email.</summary>
        public string FullName { get; set; } = string.Empty;

        /// <summary>Owner, Manager o Member, como texto.</summary>
        public string Role { get; set; } = string.Empty;

        public string? ProfilePictureUrl { get; set; }

        public DateTime JoinedAt { get; set; }
    }
}
