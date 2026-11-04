using Microsoft.EntityFrameworkCore;
using Npgsql;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Groups.Infrastructure.Repositories;

/// <summary>
/// Invitaciones y solicitudes de membresía. El alta de una pendiente traduce la violación del
/// índice único parcial ("una sola pendiente por grupo y músico") a <c>false</c>, para que la capa
/// de aplicación responda 409 en vez de un 500.
/// </summary>
internal sealed class GroupMembershipRequestRepository(GroupsDbContext dbContext)
    : GenericRepository<GroupMembershipRequest, long>(dbContext), IGroupMembershipRequestRepository
{
    private const string MembershipRequestsTable = "group_membership_requests";

    public Task<GroupMembershipRequest?> GetPendingAsync(
        long groupId,
        long musicianUserId,
        CancellationToken cancellationToken = default)
        => dbContext.GroupMembershipRequests
            .FirstOrDefaultAsync(
                r => r.GroupId == groupId
                    && r.MusicianUserId == musicianUserId
                    && r.Status == MembershipRequestStatus.Pending,
                cancellationToken);

    public Task<List<GroupMembershipRequest>> ListByGroupAsync(
        long groupId,
        MembershipDirection? direction,
        MembershipRequestStatus? status,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.GroupMembershipRequests.AsNoTracking().Where(r => r.GroupId == groupId);
        if (direction is not null)
            query = query.Where(r => r.Direction == direction);
        if (status is not null)
            query = query.Where(r => r.Status == status);

        return query
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .ToListAsync(cancellationToken);
    }

    public Task<List<GroupMembershipRequest>> ListByMusicianAsync(
        long musicianUserId,
        MembershipDirection? direction,
        MembershipRequestStatus? status,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.GroupMembershipRequests.AsNoTracking().Where(r => r.MusicianUserId == musicianUserId);
        if (direction is not null)
            query = query.Where(r => r.Direction == direction);
        if (status is not null)
            query = query.Where(r => r.Status == status);

        return query
            .OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> TryCreatePendingAsync(
        GroupMembershipRequest request,
        CancellationToken cancellationToken = default)
    {
        await CreateAsync(request);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex) when (IsPendingDuplicate(ex))
        {
            // Otra persona creó una pendiente para el mismo par en paralelo.
            return false;
        }
    }

    private static bool IsPendingDuplicate(DbUpdateException exception)
        => exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation
        } postgres
        && postgres.TableName == MembershipRequestsTable;
}
