using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.List;

/// <summary>Solicitudes que envió el usuario actual.</summary>
public sealed record GetMyEventRequestsQuery(long ClientUserId) : IQuery<List<EventRequestResponse>>;

/// <summary>
/// Solicitudes recibidas por un grupo. El endpoint exige RequireGroupManager sobre ese
/// mismo groupId, y aquí solo se devuelven solicitudes de ese grupo.
/// </summary>
public sealed record GetGroupEventRequestsQuery(long GroupId, EventRequestStatus? Status) : IQuery<List<EventRequestResponse>>;

public sealed class GetMyEventRequestsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time)
    : IQueryHandler<GetMyEventRequestsQuery, List<EventRequestResponse>>
{
    public async Task<List<EventRequestResponse>> Handle(GetMyEventRequestsQuery query, CancellationToken cancellationToken)
    {
        var requests = await unitOfWork.EventRequests.ListByClientAsync(query.ClientUserId, cancellationToken);
        return await EventRequestResponses.BuildAsync(
            requests, groups, users, unitOfWork.EventReviews, time, query.ClientUserId, includeMessages: false, cancellationToken);
    }
}

public sealed class GetGroupEventRequestsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time)
    : IQueryHandler<GetGroupEventRequestsQuery, List<EventRequestResponse>>
{
    public async Task<List<EventRequestResponse>> Handle(GetGroupEventRequestsQuery query, CancellationToken cancellationToken)
    {
        var requests = await unitOfWork.EventRequests.ListByGroupAsync(query.GroupId, query.Status, cancellationToken);
        // La bandeja es del grupo: quien la mira administra el evento, no puede reseñarlo.
        return await EventRequestResponses.BuildAsync(
            requests, groups, users, unitOfWork.EventReviews, time, callerUserId: null, includeMessages: false, cancellationToken);
    }
}
