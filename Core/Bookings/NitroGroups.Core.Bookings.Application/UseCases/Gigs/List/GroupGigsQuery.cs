using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
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

        return await GroupGigResponses.LoadAsync(
            unitOfWork, groups, users, query.GroupId, query.CallerUserId, gigs, cancellationToken);
    }
}
