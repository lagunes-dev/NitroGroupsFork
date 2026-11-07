using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Core.Groups.Infrastructure.Repositories;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// La regla "una visita por grupo y músico" es un índice único, y la migración nueva tiene que
/// aplicarse de verdad: las dos cosas necesitan PostgreSQL real. Refrescar el perfil actualiza la
/// fila que ya existe en vez de crear otra.
/// </summary>
public class ProfileVisitPostgresTests
{
    private const long MusicianUserId = 20;

    private static GroupsDbContext Context(string cs) =>
        new(new DbContextOptionsBuilder<GroupsDbContext>().UseNpgsql(cs).Options);

    private static async Task<long> AddGroupAsync(GroupsDbContext context)
    {
        var group = new Group { OwnerUserId = 30, Slug = "los-vargas", GroupName = "Los Vargas", Currency = "MXN", Active = true };
        context.Groups.Add(group);
        await context.SaveChangesAsync();
        return group.Id;
    }

    [PostgresFact]
    public async Task LaMigracionSeAplica_YRefrescarMueveLaFechaEnVezDeCrearOtraFila()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using (var migrate = Context(db.ConnectionString)) await migrate.Database.MigrateAsync();

        long groupId;
        await using (var setup = Context(db.ConnectionString))
            groupId = await AddGroupAsync(setup);

        await using (var visits = Context(db.ConnectionString))
            await new ProfileVisitRepository(visits).RecordAsync(groupId, MusicianUserId);

        DateTime firstVisitedAt;
        await using (var read = Context(db.ConnectionString))
            firstVisitedAt = (await read.GroupProfileVisits.AsNoTracking().SingleAsync()).LastVisitedAt;

        await using (var visits = Context(db.ConnectionString))
            await new ProfileVisitRepository(visits).RecordAsync(groupId, MusicianUserId);

        await using (var read = Context(db.ConnectionString))
        {
            var visit = Assert.Single(await read.GroupProfileVisits.AsNoTracking().ToListAsync());
            Assert.Equal(groupId, visit.GroupId);
            Assert.True(visit.LastVisitedAt >= firstVisitedAt);
        }

        // El índice único sigue ahí: una segunda fila para el mismo par no se puede escribir.
        await using var duplicate = Context(db.ConnectionString);
        duplicate.GroupProfileVisits.Add(GroupProfileVisit.Create(groupId, MusicianUserId, DateTime.UtcNow));
        await Assert.ThrowsAsync<DbUpdateException>(() => duplicate.SaveChangesAsync());
    }
}
