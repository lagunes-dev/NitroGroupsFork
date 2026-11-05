using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;

/// <summary>
/// S2 y S4: los toques de un grupo con las respuestas de sus miembros. El endpoint exige
/// RequireGroupManager sobre ese mismo groupId; el rol es el del llamante (vacío si es admin).
/// </summary>
public sealed record GetGroupGigsQuery(long GroupId, long? CallerUserId) : IQuery<List<GroupGigResponse>>;

public sealed class GetGroupGigsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time) : IQueryHandler<GetGroupGigsQuery, List<GroupGigResponse>>
{
    public async Task<List<GroupGigResponse>> Handle(GetGroupGigsQuery query, CancellationToken cancellationToken)
    {
        var gigs = await unitOfWork.EventRequests.ListAcceptedGigsAsync(
            [query.GroupId], GigAgenda.FirstVisibleDate(time), cancellationToken);

        if (gigs.Count == 0)
            return [];

        var group = await groups.GetGroupAsync(query.GroupId, cancellationToken);

        IReadOnlyList<GroupMembershipSummary> memberships = query.CallerUserId is null
            ? []
            : await groups.GetUserGroupMembershipsAsync(query.CallerUserId.Value, cancellationToken);
        var membership = memberships.FirstOrDefault(candidate => candidate.GroupId == query.GroupId);

        var attendance = await unitOfWork.GigAttendances.ListByEventRequestsAsync(
            gigs.Select(gig => gig.Id).ToList(), cancellationToken);
        var byGig = attendance
            .GroupBy(row => row.EventRequestId)
            .ToDictionary(rows => rows.Key, rows => rows.ToList());
        var userMap = await users.GetUsersAsync(
            attendance.Select(row => row.UserId).Distinct(), cancellationToken);

        return GroupGigResponses.Build(
            gigs,
            group?.GroupName ?? membership?.GroupName ?? string.Empty,
            group?.Slug ?? membership?.Slug ?? string.Empty,
            membership?.Role,
            query.CallerUserId,
            byGig,
            userMap);
    }
}
