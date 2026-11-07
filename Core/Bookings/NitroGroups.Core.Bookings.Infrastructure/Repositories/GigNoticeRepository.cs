using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Bookings.Infrastructure.Repositories;

internal sealed class GigNoticeRepository(BookingsDbContext dbContext)
    : GenericRepository<GigNotice, long>(dbContext), IGigNoticeRepository
{
    public Task<GigNotice?> FindByDayAsync(
        long eventRequestId,
        long userId,
        GigNoticeKind kind,
        DateOnly sentOn,
        CancellationToken cancellationToken = default)
        => dbContext.GigNotices.AsNoTracking()
            .FirstOrDefaultAsync(row => row.EventRequestId == eventRequestId
                && row.UserId == userId
                && row.Kind == kind
                && row.SentOn == sentOn, cancellationToken);

    public Task<List<GigNotice>> ListByUserAndDayAsync(
        long userId,
        DateOnly sentOn,
        CancellationToken cancellationToken = default)
        => dbContext.GigNotices.AsNoTracking()
            .Where(row => row.UserId == userId && row.SentOn == sentOn)
            .OrderBy(row => row.Id)
            .ToListAsync(cancellationToken);

    public Task<List<GigNotice>> ListByGroupAsync(long groupId, CancellationToken cancellationToken = default)
        => dbContext.GigNotices.AsNoTracking()
            .Where(row => dbContext.EventRequests.Any(gig => gig.Id == row.EventRequestId && gig.GroupId == groupId))
            .OrderByDescending(row => row.SentOn)
            .ThenByDescending(row => row.Id)
            .ToListAsync(cancellationToken);
}
