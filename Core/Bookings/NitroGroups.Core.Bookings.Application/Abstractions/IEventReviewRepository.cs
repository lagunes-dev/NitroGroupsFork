using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;
using NitroGroups.Shared.Contracts;

namespace NitroGroups.Core.Bookings.Application.Abstractions;

/// <summary>Una reseña del grupo con el tipo de evento del toque reseñado y quién la escribió.</summary>
public sealed record GroupReviewRow(int Rating, string? Comment, DateTime CreatedAt, string EventType, long ClientUserId);

/// <summary>Promedio (dos decimales) y cantidad de reseñas del grupo.</summary>
public sealed record GroupReviewSummary(decimal Average, int Count);

public interface IEventReviewRepository : IGenericRepository<EventReview, long>
{
    /// <summary>La reseña de ese evento, o null si todavía no tiene.</summary>
    Task<EventReview?> GetByEventRequestAsync(long eventRequestId, CancellationToken cancellationToken = default);

    /// <summary>Las reseñas de esos eventos (vacío si ninguno tiene).</summary>
    Task<List<EventReview>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        CancellationToken cancellationToken = default);

    /// <summary>Reseñas del grupo, de la más reciente a la más antigua, paginadas.</summary>
    Task<PagedResult<GroupReviewRow>> ListByGroupAsync(
        long groupId,
        int page,
        int size,
        CancellationToken cancellationToken = default);

    /// <summary>Resumen del grupo calculado con sus filas de reseñas.</summary>
    Task<GroupReviewSummary> SummarizeAsync(long groupId, CancellationToken cancellationToken = default);
}
