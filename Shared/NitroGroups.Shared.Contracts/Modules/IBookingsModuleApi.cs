namespace NitroGroups.Shared.Contracts.Modules
{
    /// <summary>
    /// API pública del módulo Bookings. Es la única forma en que otros módulos saben qué
    /// grupos ya tienen un evento aceptado, sin leer el esquema de reservas.
    /// </summary>
    public interface IBookingsModuleApi
    {
        /// <summary>
        /// De los grupos dados, los que ya tienen una solicitud aceptada ese día. Un grupo
        /// ocupado no se puede anunciar como libre para la misma fecha. Solo cuenta lo
        /// aceptado: una solicitud pendiente, rechazada o cancelada no es agenda.
        /// </summary>
        Task<IReadOnlySet<long>> GetBusyGroupIdsAsync(
            IReadOnlyCollection<long> groupIds,
            DateOnly date,
            CancellationToken cancellationToken = default);
    }
}
