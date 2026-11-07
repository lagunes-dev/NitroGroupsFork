using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Bookings.Infrastructure.Repositories;

internal sealed class GigPayRepository(BookingsDbContext dbContext)
    : GenericRepository<GigPay, long>(dbContext), IGigPayRepository
{
    public Task<List<GigPay>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        CancellationToken cancellationToken = default)
        => eventRequestIds.Count == 0
            ? Task.FromResult(new List<GigPay>())
            : dbContext.GigPays.AsNoTracking()
                .Where(row => eventRequestIds.Contains(row.EventRequestId))
                .ToListAsync(cancellationToken);

    public Task<List<GigPay>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        long userId,
        CancellationToken cancellationToken = default)
        => eventRequestIds.Count == 0
            ? Task.FromResult(new List<GigPay>())
            : dbContext.GigPays.AsNoTracking()
                .Where(row => row.UserId == userId && eventRequestIds.Contains(row.EventRequestId))
                .ToListAsync(cancellationToken);

    public Task<List<GigPay>> ListForReplaceAsync(long eventRequestId, CancellationToken cancellationToken = default)
        => dbContext.GigPays.IgnoreQueryFilters()
            .Where(row => row.EventRequestId == eventRequestId)
            .ToListAsync(cancellationToken);
}
