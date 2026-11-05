using NitroGroups.Shared.Abstractions.Repository;

namespace NitroGroups.Core.Bookings.Application.Abstractions;

public interface IUnitOfWorkBookings : IUnitOfWork
{
    IEventRequestRepository EventRequests { get; }
    IGigAttendanceRepository GigAttendances { get; }
    IGigPayRepository GigPays { get; }
    IGigNoticeRepository GigNotices { get; }
    IEventReviewRepository EventReviews { get; }
}
