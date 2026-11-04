using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// The "one pending request per group and musician" rule is a partial unique index, so it
/// needs real PostgreSQL: the in-memory provider does not enforce indexes.
/// </summary>
public class GroupMembershipRequestPostgresTests
{
    private static GroupsDbContext Context(string cs) =>
        new(new DbContextOptionsBuilder<GroupsDbContext>().UseNpgsql(cs).Options);

    private static GroupMembershipRequest NewRequest(long groupId, MembershipDirection direction) =>
        GroupMembershipRequest.Create(groupId, musicianUserId: 20, initiatedByUserId: 30, direction, null);

    [PostgresFact]
    public async Task SecondPendingForSameGroupAndMusician_IsRejected_UntilTheFirstIsResolved()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using (var migrate = Context(db.ConnectionString)) await migrate.Database.MigrateAsync();

        await using var ctx = Context(db.ConnectionString);
        var group = new Group { OwnerUserId = 30, Slug = "mariachi-oro", GroupName = "Mariachi Oro", Currency = "MXN", Active = true };
        ctx.Groups.Add(group);
        await ctx.SaveChangesAsync();

        var first = NewRequest(group.Id, MembershipDirection.Invitation);
        ctx.GroupMembershipRequests.Add(first);
        await ctx.SaveChangesAsync();

        // Same group and musician while the first is Pending, even from the other direction.
        await using (var other = Context(db.ConnectionString))
        {
            other.GroupMembershipRequests.Add(NewRequest(group.Id, MembershipDirection.Request));
            await Assert.ThrowsAsync<DbUpdateException>(() => other.SaveChangesAsync());
        }

        first.Decline(20);
        await ctx.SaveChangesAsync();

        await using var again = Context(db.ConnectionString);
        again.GroupMembershipRequests.Add(NewRequest(group.Id, MembershipDirection.Request));
        await again.SaveChangesAsync();

        await using var check = Context(db.ConnectionString);
        Assert.Equal(2, await check.GroupMembershipRequests.CountAsync(r => r.GroupId == group.Id));
        Assert.Equal(1, await check.GroupMembershipRequests
            .CountAsync(r => r.GroupId == group.Id && r.Status == MembershipRequestStatus.Pending));
    }
}
