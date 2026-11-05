using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Bookings.Infrastructure.Repositories;

internal sealed class EventRequestRepository(BookingsDbContext dbContext)
    : GenericRepository<EventRequest, long>(dbContext), IEventRequestRepository
{
    public Task<EventRequest?> GetWithMessagesAsync(long id, CancellationToken cancellationToken = default)
        => dbContext.EventRequests
            .Include(r => r.Messages)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public Task<EventRequest?> GetWithAttendanceAsync(long id, CancellationToken cancellationToken = default)
        => dbContext.EventRequests
            .Include(r => r.Attendance)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

    public Task<List<EventRequest>> ListByClientAsync(long clientUserId, CancellationToken cancellationToken = default)
        => dbContext.EventRequests.AsNoTracking()
            .Where(r => r.ClientUserId == clientUserId)
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .ToListAsync(cancellationToken);

    public Task<List<EventRequest>> ListByGroupAsync(long groupId, EventRequestStatus? status, CancellationToken cancellationToken = default)
    {
        var query = dbContext.EventRequests.AsNoTracking().Where(r => r.GroupId == groupId);
        if (status is not null)
            query = query.Where(r => r.Status == status);

        return query
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .ToListAsync(cancellationToken);
    }

    public Task<List<EventRequest>> ListAcceptedGigsAsync(
        IReadOnlyCollection<long> groupIds,
        DateOnly fromEventDate,
        CancellationToken cancellationToken = default)
        // Un toque es una solicitud aceptada (Pending, Declined y Cancelled nunca son agenda).
        => groupIds.Count == 0
            ? Task.FromResult(new List<EventRequest>())
            : dbContext.EventRequests.AsNoTracking()
                .Where(r => groupIds.Contains(r.GroupId)
                    && r.Status == EventRequestStatus.Accepted
                    && r.EventDate >= fromEventDate)
                .OrderBy(r => r.EventDate).ThenBy(r => r.StartTime).ThenBy(r => r.Id)
                .ToListAsync(cancellationToken);

    public Task<List<EventRequest>> ListAcceptedOnDateAsync(
        long groupId,
        DateOnly eventDate,
        long excludeEventRequestId,
        CancellationToken cancellationToken = default)
        => dbContext.EventRequests.AsNoTracking()
            .Where(r => r.GroupId == groupId
                && r.Status == EventRequestStatus.Accepted
                && r.EventDate == eventDate
                && r.Id != excludeEventRequestId)
            .OrderBy(r => r.Id)
            .ToListAsync(cancellationToken);
}
