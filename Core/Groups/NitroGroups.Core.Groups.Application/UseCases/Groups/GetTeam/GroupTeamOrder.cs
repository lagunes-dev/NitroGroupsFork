using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetTeam;

/// <summary>
/// El único orden del equipo de un grupo: Owner, Manager, Member (por privilegio) y, dentro de un
/// rol, la membresía más antigua primero. Lo leen el equipo del manager y el equipo público, así
/// que ambos muestran la misma lista en el mismo orden.
/// </summary>
internal static class GroupTeamOrder
{
    public static IOrderedEnumerable<GroupMember> ByTeamOrder(this IEnumerable<GroupMember> rows)
        => rows.OrderBy(row => RolePriority(row.Role)).ThenBy(row => row.JoinedAt);

    private static int RolePriority(GroupMemberRole role) => role switch
    {
        GroupMemberRole.Owner => 0,
        GroupMemberRole.Manager => 1,
        _ => 2
    };
}
