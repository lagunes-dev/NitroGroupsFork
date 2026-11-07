using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetTeam;

/// <summary>
/// El equipo que el manager reconoce: los miembros activos de su grupo con nombre y rol.
/// El endpoint exige <c>RequireGroupManager</c> sobre ese mismo groupId; aquí solo se leen las
/// filas activas de ese grupo (una membresía dada de baja no es parte del equipo).
/// </summary>
public sealed record GetGroupTeamQuery(long GroupId) : IQuery<GroupsResult<List<GroupTeamMemberResponse>>>;

public sealed class GetGroupTeamQueryHandler(IUnitOfWorkGroups unitOfWork, IUsersModuleApi users)
    : IQueryHandler<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>
{
    private const string GroupNotFoundMessage = "Grupo no encontrado.";

    public async Task<GroupsResult<List<GroupTeamMemberResponse>>> Handle(
        GetGroupTeamQuery query,
        CancellationToken cancellationToken)
    {
        if (await unitOfWork.Groups.GetByIdAsync(query.GroupId) is null)
            return GroupsResult<List<GroupTeamMemberResponse>>.NotFound(GroupNotFoundMessage);

        var rows = (await unitOfWork.GroupMembers.FindAsync(
            member => member.GroupId == query.GroupId && member.IsActive)).ToList();
        if (rows.Count == 0)
            return GroupsResult<List<GroupTeamMemberResponse>>.Success([]);

        var userMap = await users.GetUsersAsync(
            rows.Select(row => row.UserId).Distinct(), cancellationToken);

        // Owner, Manager, Member (by privilege), then the oldest membership first.
        var team = rows
            .OrderBy(row => RolePriority(row.Role))
            .ThenBy(row => row.JoinedAt)
            .Select(row =>
            {
                var user = userMap.GetValueOrDefault(row.UserId);
                return new GroupTeamMemberResponse
                {
                    UserId = row.UserId,
                    FullName = DisplayName(user),
                    Role = row.Role.ToString(),
                    ProfilePictureUrl = user?.ProfilePictureUrl,
                    JoinedAt = row.JoinedAt
                };
            })
            .ToList();

        return GroupsResult<List<GroupTeamMemberResponse>>.Success(team);
    }

    /// <summary>
    /// "Nombre Apellido"; si el nombre está vacío, la parte local de su email. El email completo
    /// nunca sale del módulo Users por esta vía.
    /// </summary>
    private static string DisplayName(UserSummary? user)
    {
        if (user is null)
            return string.Empty;

        if (!string.IsNullOrWhiteSpace(user.FullName))
            return user.FullName;

        var separator = user.Email.IndexOf('@');
        return separator < 0 ? user.Email : user.Email[..separator];
    }

    private static int RolePriority(GroupMemberRole role) => role switch
    {
        GroupMemberRole.Owner => 0,
        GroupMemberRole.Manager => 1,
        _ => 2
    };
}
