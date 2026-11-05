using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Abstractions.Events;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Bookings.Infrastructure.Repositories;

public class UnitOfWorkBookings(
    BookingsDbContext context,
    IOutboxService outboxService,
    IEventRequestRepository eventRequests,
    IGigAttendanceRepository gigAttendances,
    IGigPayRepository gigPays,
    IEventReviewRepository eventReviews) : UnitOfWork(context, outboxService), IUnitOfWorkBookings
{
    public IEventRequestRepository EventRequests { get; } = eventRequests;
    public IGigAttendanceRepository GigAttendances { get; } = gigAttendances;
    public IGigPayRepository GigPays { get; } = gigPays;
    public IEventReviewRepository EventReviews { get; } = eventReviews;
}
