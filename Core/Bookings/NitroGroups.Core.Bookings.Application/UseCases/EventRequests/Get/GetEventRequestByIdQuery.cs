using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Get;

/// <summary>Detalle con mensajes. Solo el cliente, un manager del grupo o un admin; si no, 404.</summary>
public sealed record GetEventRequestByIdQuery(long Id, long? UserId, bool IsAdmin) : IQuery<BookingResult<EventRequestResponse>>;

public sealed class GetEventRequestByIdQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time)
    : IQueryHandler<GetEventRequestByIdQuery, BookingResult<EventRequestResponse>>
{
    public async Task<BookingResult<EventRequestResponse>> Handle(GetEventRequestByIdQuery query, CancellationToken cancellationToken)
    {
        var request = await unitOfWork.EventRequests.GetWithMessagesAsync(query.Id, cancellationToken);
        if (request is null)
            return BookingResult<EventRequestResponse>.NotFound();

        if (!query.IsAdmin)
        {
            var participation = await EventRequestParticipation.ResolveAsync(request, query.UserId, groups, cancellationToken);
            if (!participation.IsParticipant)
                return BookingResult<EventRequestResponse>.NotFound();
        }

        var response = await EventRequestResponses.BuildAsync(
            request, groups, users, unitOfWork.EventReviews, time, query.UserId, includeMessages: true, cancellationToken);
        return BookingResult<EventRequestResponse>.Success(response);
    }
}
