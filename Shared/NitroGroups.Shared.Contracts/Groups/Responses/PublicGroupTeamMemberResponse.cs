namespace NitroGroups.Shared.Contracts.Groups.Responses
{
    /// <summary>
    /// Un miembro activo del grupo tal como lo ve el perfil público (S14): nombre, rol e
    /// instrumento · ciudad. <see cref="UserId"/> es el único id que viaja, y es el del perfil
    /// público del músico (<c>/musicians/{userId}</c>). Nunca lleva email.
    /// </summary>
    public sealed class PublicGroupTeamMemberResponse
    {
        /// <summary>Id del usuario, el mismo de <c>/musicians/{userId}</c>.</summary>
        public long UserId { get; set; }

        /// <summary>
        /// "Nombre Apellido". Vacío cuando la fila del usuario no tiene nombre: acá no se cae a la
        /// parte local del correo, porque este endpoint lo lee cualquiera.
        /// </summary>
        public string FullName { get; set; } = string.Empty;

        /// <summary>Owner, Manager o Member, como texto (el front lo rotula en español).</summary>
        public string Role { get; set; } = string.Empty;

        /// <summary>
        /// Instrumentos que toca; null si no los cargó o si cerró su perfil (<c>IsOpenToJoin</c>).
        /// </summary>
        public string? Instruments { get; set; }

        /// <summary>Ciudad del músico; null si no la cargó o si cerró su perfil.</summary>
        public string? City { get; set; }
    }
}
