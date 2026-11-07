using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Bookings.Infrastructure.Repositories;

internal sealed class EventReviewRepository(BookingsDbContext dbContext)
    : GenericRepository<EventReview, long>(dbContext), IEventReviewRepository
{
    public Task<EventReview?> GetByEventRequestAsync(long eventRequestId, CancellationToken cancellationToken = default)
        => dbContext.EventReviews.AsNoTracking()
            .FirstOrDefaultAsync(review => review.EventRequestId == eventRequestId, cancellationToken);

    public Task<List<EventReview>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        CancellationToken cancellationToken = default)
        => eventRequestIds.Count == 0
            ? Task.FromResult(new List<EventReview>())
            : dbContext.EventReviews.AsNoTracking()
                .Where(review => eventRequestIds.Contains(review.EventRequestId))
                .ToListAsync(cancellationToken);

    public async Task<PagedResult<GroupReviewRow>> ListByGroupAsync(
        long groupId,
        int page,
        int size,
        CancellationToken cancellationToken = default)
    {
        var reviews = dbContext.EventReviews.AsNoTracking().Where(review => review.GroupId == groupId);
        var total = await reviews.CountAsync(cancellationToken);

        // El tipo de evento vive en la solicitud: se une para que el perfil no tenga que pedirlo.
        var rows = await (from review in reviews
                          join request in dbContext.EventRequests.AsNoTracking()
                              on review.EventRequestId equals request.Id
                          orderby review.CreatedAt descending, review.Id descending
                          select new GroupReviewRow(
                              review.Rating, review.Comment, review.CreatedAt, request.EventType, review.ClientUserId))
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        return new PagedResult<GroupReviewRow>(rows, total, page, size);
    }

    public async Task<GroupReviewSummary> SummarizeAsync(long groupId, CancellationToken cancellationToken = default)
    {
        // Se promedian las filas reales de reseñas (no el agregado guardado en el perfil).
        var ratings = await dbContext.EventReviews.AsNoTracking()
            .Where(review => review.GroupId == groupId)
            .Select(review => review.Rating)
            .ToListAsync(cancellationToken);

        return ratings.Count == 0
            ? new GroupReviewSummary(0m, 0)
            : new GroupReviewSummary(
                Math.Round(ratings.Average(rating => (decimal)rating), 2, MidpointRounding.AwayFromZero),
                ratings.Count);
    }
}
