using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

public class GroupsModuleApiIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private const long OwnerId = 10;
    private const long ManagerId = 11;
    private const long MemberId = 12;
    private const long InactiveManagerId = 13;
    private const long StrangerId = 99;

    [Theory]
    [InlineData(OwnerId, true)]
    [InlineData(ManagerId, true)]
    [InlineData(MemberId, false)]
    [InlineData(InactiveManagerId, false)]
    [InlineData(StrangerId, false)]
    public async Task CanManageGroupAsync_SoloOwnerYManagerActivos(long userId, bool expected)
    {
        await using var context = fixture.CreateGroupsContext();
        var groupId = await SeedGroupAsync(context);
        var api = new GroupsModuleApi(context);

        var canManage = await api.CanManageGroupAsync(groupId, userId);

        Assert.Equal(expected, canManage);
    }

    [Fact]
    public async Task CanManageGroupAsync_OwnerRegistradoComoMiembroOwner()
    {
        await using var context = fixture.CreateGroupsContext();
        const long memberOwnerId = 20;
        var groupId = await SeedGroupAsync(context);
        context.GroupMembers.Add(new GroupMember { GroupId = groupId, UserId = memberOwnerId, Role = GroupMemberRole.Owner, IsActive = true });
        await context.SaveChangesAsync();

        Assert.True(await new GroupsModuleApi(context).CanManageGroupAsync(groupId, memberOwnerId));
    }

    [Fact]
    public async Task GetManagerUserIdsAsync_IncluyeOwnerYManagersActivos()
    {
        await using var context = fixture.CreateGroupsContext();
        var groupId = await SeedGroupAsync(context);
        var api = new GroupsModuleApi(context);

        var managers = await api.GetManagerUserIdsAsync(groupId);

        Assert.Equal([OwnerId, ManagerId], managers.Order());
    }

    [Fact]
    public async Task GetUserGroupMembershipsAsync_SoloActivas_YOwnerManagerMemberConLaMasViejaPrimero()
    {
        await using var context = fixture.CreateGroupsContext();
        var userId = 30;
        var joinedAt = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);

        var oldestMemberGroupId = await SeedNamedGroupAsync(context, "Los Viejos");
        var newerMemberGroupId = await SeedNamedGroupAsync(context, "Los Nuevos");
        var managerGroupId = await SeedNamedGroupAsync(context, "Los Managers");
        var ownerGroupId = await SeedNamedGroupAsync(context, "Los Dueños");
        var formerGroupId = await SeedNamedGroupAsync(context, "Los Ex");

        context.GroupMembers.AddRange(
            new GroupMember { GroupId = oldestMemberGroupId, UserId = userId, Role = GroupMemberRole.Member, IsActive = true, JoinedAt = joinedAt.AddYears(-3) },
            new GroupMember { GroupId = newerMemberGroupId, UserId = userId, Role = GroupMemberRole.Member, IsActive = true, JoinedAt = joinedAt.AddMonths(-1) },
            new GroupMember { GroupId = managerGroupId, UserId = userId, Role = GroupMemberRole.Manager, IsActive = true, JoinedAt = joinedAt },
            new GroupMember { GroupId = ownerGroupId, UserId = userId, Role = GroupMemberRole.Owner, IsActive = true, JoinedAt = joinedAt },
            // La fila inactiva (grupo del que ya salió) no debe aparecer.
            new GroupMember { GroupId = formerGroupId, UserId = userId, Role = GroupMemberRole.Owner, IsActive = false, JoinedAt = joinedAt.AddYears(-5) },
            // La membresía de otro usuario no se mezcla.
            new GroupMember { GroupId = formerGroupId, UserId = 31, Role = GroupMemberRole.Owner, IsActive = true, JoinedAt = joinedAt });
        await context.SaveChangesAsync();

        var memberships = await new GroupsModuleApi(context).GetUserGroupMembershipsAsync(userId);

        // Owner, Manager, Member (por privilegio) y, dentro del mismo rol, la membresía más vieja primero.
        Assert.Equal(
            [ownerGroupId, managerGroupId, oldestMemberGroupId, newerMemberGroupId],
            memberships.Select(m => m.GroupId));
        Assert.Equal(
            [GroupMemberRole.Owner, GroupMemberRole.Manager, GroupMemberRole.Member, GroupMemberRole.Member],
            memberships.Select(m => m.Role));
        Assert.Equal(["Los Dueños", "Los Managers", "Los Viejos", "Los Nuevos"], memberships.Select(m => m.GroupName));
        Assert.Equal(joinedAt.AddYears(-3), memberships[2].JoinedAt);
    }

    [Fact]
    public async Task GetUserGroupMembershipsAsync_SinMembresias_ListaVacia()
    {
        await using var context = fixture.CreateGroupsContext();

        Assert.Empty(await new GroupsModuleApi(context).GetUserGroupMembershipsAsync(StrangerId));
    }

    private static async Task<long> SeedNamedGroupAsync(
        Core.Groups.Infrastructure.Persistence.GroupsDbContext context, string groupName)
    {
        var group = new Group
        {
            OwnerUserId = OwnerId,
            Slug = $"los-test-{Guid.NewGuid():N}",
            GroupName = groupName,
            Active = true
        };
        context.Groups.Add(group);
        await context.SaveChangesAsync();
        return group.Id;
    }

    private static async Task<long> SeedGroupAsync(Core.Groups.Infrastructure.Persistence.GroupsDbContext context)
    {
        var group = new Group { OwnerUserId = OwnerId, Slug = $"los-test-{Guid.NewGuid():N}", GroupName = "Los Test", Active = true };
        context.Groups.Add(group);
        await context.SaveChangesAsync();

        context.GroupMembers.AddRange(
            new GroupMember { GroupId = group.Id, UserId = ManagerId, Role = GroupMemberRole.Manager, IsActive = true },
            new GroupMember { GroupId = group.Id, UserId = MemberId, Role = GroupMemberRole.Member, IsActive = true },
            new GroupMember { GroupId = group.Id, UserId = InactiveManagerId, Role = GroupMemberRole.Manager, IsActive = false });
        await context.SaveChangesAsync();

        return group.Id;
    }
}
