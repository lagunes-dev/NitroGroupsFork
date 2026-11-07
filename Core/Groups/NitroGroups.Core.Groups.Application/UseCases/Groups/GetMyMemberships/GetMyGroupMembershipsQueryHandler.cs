using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetMyMemberships;

public sealed record GetMyGroupMembershipsQuery(long UserId) : IQuery<GroupsResult<List<GroupMembershipSummary>>>;

public sealed class GetMyGroupMembershipsQueryHandler(IUnitOfWorkGroups unitOfWork)
    : IQueryHandler<GetMyGroupMembershipsQuery, GroupsResult<List<GroupMembershipSummary>>>
{
    public async Task<GroupsResult<List<GroupMembershipSummary>>> Handle(GetMyGroupMembershipsQuery query, CancellationToken cancellationToken)
    {
        var rows = (await unitOfWork.GroupMembers.FindAsync(member => member.UserId == query.UserId && member.IsActive)).ToList();
        if (rows.Count == 0)
            return GroupsResult<List<GroupMembershipSummary>>.Success([]);

        var groupIds = rows.Select(row => row.GroupId).ToHashSet();
        var groups = (await unitOfWork.Groups.FindAsync(group => groupIds.Contains(group.Id))).ToDictionary(group => group.Id);

        // Owner, Manager, Member (by privilege), then the oldest membership first.
        var memberships = rows
            .Where(row => groups.ContainsKey(row.GroupId))
            .OrderBy(row => RolePriority(row.Role))
            .ThenBy(row => row.JoinedAt)
            .Select(row => new GroupMembershipSummary
            {
                GroupId = row.GroupId,
                GroupName = groups[row.GroupId].GroupName,
                Slug = groups[row.GroupId].Slug,
                ProfilePictureUrl = groups[row.GroupId].ProfilePictureUrl,
                Role = row.Role,
                JoinedAt = row.JoinedAt
            })
            .ToList();

        return GroupsResult<List<GroupMembershipSummary>>.Success(memberships);
    }

    private static int RolePriority(GroupMemberRole role) => role switch
    {
        GroupMemberRole.Owner => 0,
        GroupMemberRole.Manager => 1,
        _ => 2
    };
}
