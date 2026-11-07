using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Bookings.Infrastructure.Repositories;

internal sealed class GigAttendanceRepository(BookingsDbContext dbContext)
    : GenericRepository<GigAttendance, long>(dbContext), IGigAttendanceRepository
{
    public Task<List<GigAttendance>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        CancellationToken cancellationToken = default)
        => eventRequestIds.Count == 0
            ? Task.FromResult(new List<GigAttendance>())
            : dbContext.GigAttendances.AsNoTracking()
                .Where(row => eventRequestIds.Contains(row.EventRequestId))
                .ToListAsync(cancellationToken);

    public Task<List<GigAttendance>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        long userId,
        CancellationToken cancellationToken = default)
        => eventRequestIds.Count == 0
            ? Task.FromResult(new List<GigAttendance>())
            : dbContext.GigAttendances.AsNoTracking()
                .Where(row => row.UserId == userId && eventRequestIds.Contains(row.EventRequestId))
                .ToListAsync(cancellationToken);
}
