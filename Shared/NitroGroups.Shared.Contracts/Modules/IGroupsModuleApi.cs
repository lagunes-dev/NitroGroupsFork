using NitroGroups.Shared.Contracts.Groups.Responses;

namespace NitroGroups.Shared.Contracts.Modules
{
    /// <summary>Datos públicos de un grupo que otros módulos pueden consultar.</summary>
    /// <param name="BasePrice">
    /// El "desde $X" del grupo, tal como lo cargó el manager. Opcional: null cuando no lo cargó.
    /// Bookings lo usa para comparar el presupuesto que ofrece el cliente (D6); nunca para cobrar.
    /// </param>
    /// <param name="Phone">
    /// Teléfono de contacto que el manager carga en el perfil del grupo (S22). Null cuando no lo
    /// cargó o quedó en blanco: un teléfono vacío no es un dato y el front no dibuja una etiqueta
    /// vacía. Es un dato personal: solo viaja en la agenda del miembro activo del grupo, nunca al
    /// cliente ni al panel del manager.
    /// </param>
    public sealed record GroupSummary(
        long Id,
        string Slug,
        string GroupName,
        string Email,
        long OwnerUserId,
        bool IsAcceptingBookings,
        string? ProfilePictureUrl,
        bool IsActive = true,
        decimal? BasePrice = null,
        /// <summary>Moneda del grupo: la tarifa base se cuenta en la suya, no en la del cliente (S15).</summary>
        string? Currency = null,
        string? Phone = null);

    /// <summary>
    /// API pública del módulo Groups. Es la única forma en que otros módulos
    /// leen datos de grupos o preguntan por permisos sobre un grupo.
    /// </summary>
    public interface IGroupsModuleApi
    {
        Task<bool> GroupExistsAsync(long groupId, CancellationToken cancellationToken = default);
        Task<GroupSummary?> GetGroupAsync(long groupId, CancellationToken cancellationToken = default);
        Task<IReadOnlyDictionary<long, GroupSummary>> GetGroupsAsync(IEnumerable<long> groupIds, CancellationToken cancellationToken = default);

        /// <summary>true si el usuario es Owner o Manager activo del grupo.</summary>
        Task<bool> CanManageGroupAsync(long groupId, long userId, CancellationToken cancellationToken = default);

        /// <summary>Ids de usuario de los Owner/Manager activos del grupo.</summary>
        Task<IReadOnlyList<long>> GetManagerUserIdsAsync(long groupId, CancellationToken cancellationToken = default);

        /// <summary>Ids de usuario de todos los miembros activos del grupo (cualquier rol).</summary>
        Task<IReadOnlyList<long>> GetActiveMemberUserIdsAsync(long groupId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Rol de cada uno de esos usuarios dentro del grupo, como texto: "Owner", "Manager" o
        /// "Member". Solo aparecen los que tienen membresía activa; un id sin membresía no está en
        /// el diccionario. Es lo que Bookings necesita para decir con quién toca el músico (S22)
        /// sin leer el esquema de Groups: el rol que le importa es el del grupo, no el instrumento.
        /// </summary>
        Task<IReadOnlyDictionary<long, string>> GetActiveMemberRolesAsync(
            long groupId,
            IEnumerable<long> userIds,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Membresías activas del usuario, para que otros módulos muestren los grupos en los que
        /// toca sin leer el esquema de Groups. Mismas reglas que la lista de membresías propias:
        /// solo filas activas, ordenadas Owner, Manager, Member y, dentro del mismo rol, la
        /// membresía más antigua primero.
        /// </summary>
        Task<IReadOnlyList<GroupMembershipSummary>> GetUserGroupMembershipsAsync(
            long userId,
            CancellationToken cancellationToken = default);
    }
}
