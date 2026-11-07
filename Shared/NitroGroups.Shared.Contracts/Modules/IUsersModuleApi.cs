using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;

namespace NitroGroups.Shared.Contracts.Modules
{
    /// <summary>Datos públicos de un usuario que otros módulos pueden consultar.</summary>
    public sealed record UserSummary(
        long Id,
        string Email,
        string FirstName,
        string LastName,
        UserType UserType,
        string? ProfilePictureUrl)
    {
        public string FullName => $"{FirstName} {LastName}".Trim();
    }

    /// <summary>
    /// API pública del módulo Users. Es la única forma en que otros módulos
    /// leen datos de usuarios (nunca acceden a sus tablas ni a sus handlers).
    /// </summary>
    public interface IUsersModuleApi
    {
        Task<long?> GetUserIdByAuth0IdAsync(string auth0Id, CancellationToken cancellationToken = default);
        Task<UserSummary?> GetUserAsync(long userId, CancellationToken cancellationToken = default);
        Task<IReadOnlyDictionary<long, UserSummary>> GetUsersAsync(IEnumerable<long> userIds, CancellationToken cancellationToken = default);

        /// <summary>
        /// Resumen sin email de los músicos indicados (por id de usuario), para que otros módulos
        /// muestren su nombre sin conocer el email. No filtra por <c>IsOpenToJoin</c>: sirve para
        /// pintar invitaciones ya existentes.
        /// </summary>
        Task<IReadOnlyDictionary<long, OpenMusicianSummary>> GetMusicianSummariesAsync(
            IEnumerable<long> userIds,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// true solo si el usuario es un músico (no un cliente) abierto a unirse a un grupo
        /// (<c>IsOpenToJoin</c>) y su cuenta está activa. Otros módulos lo usan para no invitar a
        /// quien cerró su perfil; el dato nunca sale del módulo Users.
        /// </summary>
        Task<bool> IsMusicianOpenToJoinAsync(long userId, CancellationToken cancellationToken = default);
    }
}
