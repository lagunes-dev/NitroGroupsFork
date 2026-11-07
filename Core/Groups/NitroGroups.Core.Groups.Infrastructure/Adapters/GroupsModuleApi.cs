using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Infrastructure.Adapters
{
    /// <summary>Implementación in-process de la API pública del módulo Groups.</summary>
    internal sealed class GroupsModuleApi(GroupsDbContext context) : IGroupsModuleApi
    {
        private static readonly GroupMemberRole[] ManagerRoles = [GroupMemberRole.Owner, GroupMemberRole.Manager];

        public Task<bool> GroupExistsAsync(long groupId, CancellationToken cancellationToken = default)
            => context.Groups.AsNoTracking().AnyAsync(g => g.Id == groupId, cancellationToken);

        public async Task<GroupSummary?> GetGroupAsync(long groupId, CancellationToken cancellationToken = default)
        {
            var groups = await GetGroupsAsync([groupId], cancellationToken);
            return groups.GetValueOrDefault(groupId);
        }

        public async Task<IReadOnlyDictionary<long, GroupSummary>> GetGroupsAsync(IEnumerable<long> groupIds, CancellationToken cancellationToken = default)
        {
            var ids = groupIds.Distinct().ToList();
            if (ids.Count == 0)
                return new Dictionary<long, GroupSummary>();

            var rows = await context.Groups.AsNoTracking()
                .Where(g => ids.Contains(g.Id))
                .Select(g => new GroupSummary(g.Id, g.Slug, g.GroupName, g.Email, g.OwnerUserId, g.IsAcceptingBookings, g.ProfilePictureUrl, g.Active, g.BasePrice, g.Currency, g.Phone))
                .ToListAsync(cancellationToken);

            // S22: el teléfono del manager es un dato personal. Se normaliza en el borde del módulo,
            // así ningún consumidor recibe "" y pinta una etiqueta vacía.
            return rows.ToDictionary(g => g.Id, g => g with { Phone = NormalizePhone(g.Phone) });
        }

        /// <summary>Un teléfono vacío o solo con espacios no es un dato: el contrato dice null.</summary>
        private static string? NormalizePhone(string? phone)
            => string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();

        public async Task<bool> CanManageGroupAsync(long groupId, long userId, CancellationToken cancellationToken = default)
        {
            var isOwner = await context.Groups.AsNoTracking()
                .AnyAsync(g => g.Id == groupId && g.OwnerUserId == userId, cancellationToken);

            return isOwner || await context.GroupMembers.AsNoTracking()
                .AnyAsync(m => m.GroupId == groupId && m.UserId == userId && m.IsActive && ManagerRoles.Contains(m.Role), cancellationToken);
        }

        public async Task<IReadOnlyList<long>> GetManagerUserIdsAsync(long groupId, CancellationToken cancellationToken = default)
        {
            var managers = await context.GroupMembers.AsNoTracking()
                .Where(m => m.GroupId == groupId && m.IsActive && ManagerRoles.Contains(m.Role))
                .Select(m => m.UserId)
                .ToListAsync(cancellationToken);

            var owner = await context.Groups.AsNoTracking()
                .Where(g => g.Id == groupId)
                .Select(g => (long?)g.OwnerUserId)
                .FirstOrDefaultAsync(cancellationToken);

            if (owner is > 0)
                managers.Add(owner.Value);

            return managers.Distinct().ToList();
        }

        public async Task<IReadOnlyList<long>> GetActiveMemberUserIdsAsync(long groupId, CancellationToken cancellationToken = default)
            => await context.GroupMembers.AsNoTracking()
                .Where(m => m.GroupId == groupId && m.IsActive)
                .Select(m => m.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

        public async Task<IReadOnlyDictionary<long, string>> GetActiveMemberRolesAsync(
            long groupId,
            IEnumerable<long> userIds,
            CancellationToken cancellationToken = default)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0)
                return new Dictionary<long, string>();

            var rows = await context.GroupMembers.AsNoTracking()
                .Where(m => m.GroupId == groupId && m.IsActive && ids.Contains(m.UserId))
                .Select(m => new { m.UserId, m.Role })
                .ToListAsync(cancellationToken);

            var roles = rows
                .GroupBy(row => row.UserId)
                .ToDictionary(group => group.Key, group => group.First().Role.ToString());

            // El dueño puede no tener fila de membresía en una base vieja; su rol no se adivina:
            // sale del grupo. Solo se completa el hueco, nunca se pisa una membresía real.
            var ownerId = await context.Groups.AsNoTracking()
                .Where(g => g.Id == groupId)
                .Select(g => (long?)g.OwnerUserId)
                .FirstOrDefaultAsync(cancellationToken);

            if (ownerId is > 0 && ids.Contains(ownerId.Value))
                roles.TryAdd(ownerId.Value, GroupMemberRole.Owner.ToString());

            return roles;
        }

        public async Task<IReadOnlyList<GroupMembershipSummary>> GetUserGroupMembershipsAsync(
            long userId,
            CancellationToken cancellationToken = default)
        {
            // Same projection as GetMyGroupMembershipsQueryHandler: active rows joined with their
            // group, so a row whose group no longer exists is never listed.
            var memberships = await (
                    from member in context.GroupMembers.AsNoTracking()
                    where member.UserId == userId && member.IsActive
                    join grp in context.Groups.AsNoTracking() on member.GroupId equals grp.Id
                    select new GroupMembershipSummary
                    {
                        GroupId = member.GroupId,
                        GroupName = grp.GroupName,
                        Slug = grp.Slug,
                        ProfilePictureUrl = grp.ProfilePictureUrl,
                        Role = member.Role,
                        JoinedAt = member.JoinedAt
                    })
                .ToListAsync(cancellationToken);

            // Owner, Manager, Member (by privilege), then the oldest membership first.
            return memberships
                .OrderBy(membership => RolePriority(membership.Role))
                .ThenBy(membership => membership.JoinedAt)
                .ToList();
        }

        private static int RolePriority(GroupMemberRole role) => role switch
        {
            GroupMemberRole.Owner => 0,
            GroupMemberRole.Manager => 1,
            _ => 2
        };
    }
}
