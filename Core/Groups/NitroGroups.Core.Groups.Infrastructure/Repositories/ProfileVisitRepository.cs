using Microsoft.EntityFrameworkCore;
using Npgsql;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Groups.Infrastructure.Repositories;

/// <summary>
/// Visitas al perfil de un músico. Una fila por (grupo, músico): el índice único lo garantiza y
/// aquí se traduce en una actualización de la fecha en vez de un error 500 cuando dos pestañas
/// registran la misma visita a la vez.
/// </summary>
internal sealed class ProfileVisitRepository(GroupsDbContext dbContext)
    : GenericRepository<GroupProfileVisit, long>(dbContext), IProfileVisitRepository
{
    private const string VisitsTable = "group_profile_visits";

    public Task<GroupProfileVisit?> GetAsync(
        long groupId,
        long musicianUserId,
        CancellationToken cancellationToken = default)
        => dbContext.GroupProfileVisits
            .FirstOrDefaultAsync(v => v.GroupId == groupId && v.MusicianUserId == musicianUserId, cancellationToken);

    public Task<List<GroupProfileVisit>> ListForMusicianAsync(
        long musicianUserId,
        CancellationToken cancellationToken = default)
        => dbContext.GroupProfileVisits
            .AsNoTracking()
            .Where(v => v.MusicianUserId == musicianUserId)
            .OrderByDescending(v => v.LastVisitedAt)
            .ThenByDescending(v => v.Id)
            .ToListAsync(cancellationToken);

    public async Task RecordAsync(long groupId, long musicianUserId, CancellationToken cancellationToken = default)
    {
        var visitedAt = DateTime.UtcNow;

        if (await GetAsync(groupId, musicianUserId, cancellationToken) is { } existing)
        {
            existing.MarkVisited(visitedAt);
            await dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        var visit = GroupProfileVisit.Create(groupId, musicianUserId, visitedAt);
        await CreateAsync(visit);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsDuplicateVisit(ex))
        {
            // Otra pestaña registró la misma visita al mismo tiempo: la fila que ganó solo se actualiza.
            dbContext.Entry(visit).State = EntityState.Detached;
            var winner = await GetAsync(groupId, musicianUserId, cancellationToken);
            if (winner is null)
                throw;

            winner.MarkVisited(visitedAt);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private static bool IsDuplicateVisit(DbUpdateException exception)
        => exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation
        } postgres
        && postgres.TableName == VisitsTable;
}
