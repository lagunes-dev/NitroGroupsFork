using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;

/// <summary>
/// S1 y S4: los toques de los grupos donde el usuario tiene membresía activa. Los grupos salen
/// solo del contrato de Groups, nunca de su esquema.
/// </summary>
public sealed record GetMyGigsQuery(long UserId) : IQuery<List<GigResponse>>;

public sealed class GetMyGigsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    TimeProvider time) : IQueryHandler<GetMyGigsQuery, List<GigResponse>>
{
    public async Task<List<GigResponse>> Handle(GetMyGigsQuery query, CancellationToken cancellationToken)
    {
        var memberships = await groups.GetUserGroupMembershipsAsync(query.UserId, cancellationToken);
        if (memberships.Count == 0)
            return [];

        var gigs = await unitOfWork.EventRequests.ListAcceptedGigsAsync(
            memberships.Select(membership => membership.GroupId).Distinct().ToList(),
            GigAgenda.FirstVisibleDate(time),
            cancellationToken);

        if (gigs.Count == 0)
            return [];

        var attendance = await unitOfWork.GigAttendances.ListByEventRequestsAsync(
            gigs.Select(gig => gig.Id).ToList(), query.UserId, cancellationToken);

        return GigResponses.Build(
            gigs,
            memberships.ToDictionary(membership => membership.GroupId),
            attendance.ToDictionary(row => row.EventRequestId, row => row.Status));
    }
}
