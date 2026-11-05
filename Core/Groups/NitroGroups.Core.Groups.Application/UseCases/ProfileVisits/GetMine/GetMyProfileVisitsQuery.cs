using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts.Groups.Responses;

namespace NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.GetMine;

/// <param name="MusicianUserId">Siempre el usuario del token: cada músico lee sus propias visitas.</param>
public sealed record GetMyProfileVisitsQuery(long MusicianUserId) : IQuery<GroupsResult<ProfileVisitsResponse>>;

/// <summary>
/// Lo que el músico ve en su panel (S9): cuántos grupos miraron su perfil y cuáles, el más
/// reciente primero. Solo los grupos que ya son públicos —si un grupo se dio de baja después de
/// la visita, su nombre deja de mostrarse—. Sin visitas devuelve cero y una lista vacía, nunca error.
/// </summary>
public sealed class GetMyProfileVisitsQueryHandler(IUnitOfWorkGroups unitOfWork, IProfileVisitRepository visits)
    : IQueryHandler<GetMyProfileVisitsQuery, GroupsResult<ProfileVisitsResponse>>
{
    public async Task<GroupsResult<ProfileVisitsResponse>> Handle(
        GetMyProfileVisitsQuery query,
        CancellationToken cancellationToken)
    {
        // Ya vienen ordenadas de la más reciente a la más antigua.
        var rows = await visits.ListForMusicianAsync(query.MusicianUserId, cancellationToken);
        if (rows.Count == 0)
            return GroupsResult<ProfileVisitsResponse>.Success(new ProfileVisitsResponse());

        var groupIds = rows.Select(row => row.GroupId).Distinct().ToList();
        var groups = (await unitOfWork.Groups.FindAsync(group => groupIds.Contains(group.Id)))
            .Where(group => group.Active)
            .ToDictionary(group => group.Id);

        var visible = rows
            .Where(row => groups.ContainsKey(row.GroupId))
            .Select(row => new ProfileVisitGroupResponse
            {
                Id = groups[row.GroupId].Id,
                GroupName = groups[row.GroupId].GroupName,
                Slug = groups[row.GroupId].Slug,
                LastVisitedAt = row.LastVisitedAt
            })
            .ToList();

        return GroupsResult<ProfileVisitsResponse>.Success(new ProfileVisitsResponse
        {
            Count = visible.Count,
            Groups = visible
        });
    }
}
