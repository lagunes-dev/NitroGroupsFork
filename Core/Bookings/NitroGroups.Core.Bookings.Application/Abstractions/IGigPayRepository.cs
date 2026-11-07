using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;

namespace NitroGroups.Core.Bookings.Application.Abstractions;

public interface IGigPayRepository : IGenericRepository<GigPay, long>
{
    /// <summary>Pagos de esos toques, de todos los músicos (solo lectura).</summary>
    Task<List<GigPay>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        CancellationToken cancellationToken = default);

    /// <summary>Pagos de un solo usuario a esos toques (su agenda).</summary>
    Task<List<GigPay>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        long userId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Todas las filas de pago del toque, rastreadas y también las dadas de baja: el índice único
    /// de (toque, usuario) obliga a revivir una fila antigua en vez de crear otra.
    /// </summary>
    Task<List<GigPay>> ListForReplaceAsync(long eventRequestId, CancellationToken cancellationToken = default);
}
