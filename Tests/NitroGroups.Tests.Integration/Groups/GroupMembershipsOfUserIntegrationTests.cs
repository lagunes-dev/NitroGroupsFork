using NitroGroups.Core.Groups.Application.UseCases.Groups.GetByUserId;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetMyMemberships;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// S6: the caller's active memberships (<c>GET api/users/me/memberships</c>) and the group the user
/// manages (<c>GET api/users/{userId}/groups</c>), which only counts active Owner/Manager rows.
/// </summary>
public class GroupMembershipsOfUserIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;

    public GroupMembershipsOfUserIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    private Task<Result<GroupResponse?>> ManagedGroup(
        GroupMembershipTestHarness app, long userId)
        => new GetGroupByUserIdQueryHandler(app.UnitOfWork, _fixture.CreateMapper())
            .Handle(new GetGroupByUserIdQuery(userId), CancellationToken.None);

    private static async Task<List<GroupMembershipSummary>> Memberships(
        GroupMembershipTestHarness app, long userId)
    {
        var result = await new GetMyGroupMembershipsQueryHandler(app.UnitOfWork)
            .Handle(new GetMyGroupMembershipsQuery(userId), CancellationToken.None);
        Assert.True(result.IsSuccess, result.Error);
        return result.Value!;
    }

    private static async Task AddMemberAsync(
        GroupMembershipTestHarness app, long groupId, long userId, GroupMemberRole role, DateTime joinedAt, bool active = true)
    {
        app.GroupsContext.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = active,
            JoinedAt = joinedAt,
            JoinedVia = JoinedVia.Manual
        });
        await app.GroupsContext.SaveChangesAsync();
    }

    private static async Task<Group> GroupAsync(GroupMembershipTestHarness app, long groupId)
        => (await app.UnitOfWork.Groups.GetByIdAsync(groupId))!;

    [Fact]
    public async Task Owner_WithOneGroup_ManagesItAndListsIt()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var userId = await app.AddMusicianAsync("Olga", "Owner");
        var groupId = await app.AddGroupAsync(ownerId: userId);
        await AddMemberAsync(app, groupId, userId, GroupMemberRole.Owner, GroupMembershipTestHarness.Now);

        var managed = await ManagedGroup(app, userId);
        Assert.True(managed.IsSuccess, managed.Error);
        Assert.Equal(groupId, managed.Value!.Id);

        var group = await GroupAsync(app, groupId);
        var membership = Assert.Single(await Memberships(app, userId));
        Assert.Equal(groupId, membership.GroupId);
        Assert.Equal(group.GroupName, membership.GroupName);
        Assert.Equal(group.Slug, membership.Slug);
        Assert.Equal(GroupMemberRole.Owner, membership.Role);
        Assert.Equal(GroupMembershipTestHarness.Now, membership.JoinedAt);
    }

    [Fact]
    public async Task Owner_AlsoMemberOfAnotherGroup_ManagesTheOwnedOne_AndListsBothOwnerFirst()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var userId = await app.AddMusicianAsync("Omar", "Both");
        var otherGroupId = await app.AddGroupAsync(ownerId: 1);
        var ownedGroupId = await app.AddGroupAsync(ownerId: userId);
        // Joined as Member earlier: an unordered "first row" would pick it.
        await AddMemberAsync(app, otherGroupId, userId, GroupMemberRole.Member, GroupMembershipTestHarness.Now.AddYears(-2));
        await AddMemberAsync(app, ownedGroupId, userId, GroupMemberRole.Owner, GroupMembershipTestHarness.Now);

        var managed = await ManagedGroup(app, userId);
        Assert.True(managed.IsSuccess, managed.Error);
        Assert.Equal(ownedGroupId, managed.Value!.Id);

        var memberships = await Memberships(app, userId);
        Assert.Equal([ownedGroupId, otherGroupId], memberships.Select(m => m.GroupId));
        Assert.Equal([GroupMemberRole.Owner, GroupMemberRole.Member], memberships.Select(m => m.Role));
    }

    [Fact]
    public async Task OnlyMember_DoesNotManage_ButListsTheGroupAsMember()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var userId = await app.AddMusicianAsync("Mia", "Member");
        var groupId = await app.AddGroupAsync(ownerId: 1);
        await AddMemberAsync(app, groupId, userId, GroupMemberRole.Member, GroupMembershipTestHarness.Now);

        var managed = await ManagedGroup(app, userId);
        Assert.True(managed.IsFailure);
        Assert.Equal("No se encontro ningun grupo que perteneciera al usuario", managed.Error);

        var membership = Assert.Single(await Memberships(app, userId));
        Assert.Equal(groupId, membership.GroupId);
        Assert.Equal(GroupMemberRole.Member, membership.Role);
    }

    [Fact]
    public async Task InactiveRows_AreIgnoredByBoth()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var userId = await app.AddMusicianAsync("Ines", "Inactive");
        var formerGroupId = await app.AddGroupAsync(ownerId: userId);
        await AddMemberAsync(app, formerGroupId, userId, GroupMemberRole.Owner, GroupMembershipTestHarness.Now, active: false);

        var managed = await ManagedGroup(app, userId);
        Assert.True(managed.IsFailure);
        Assert.Empty(await Memberships(app, userId));
    }

    [Fact]
    public async Task Manager_CountsAsManaging_OwnerStillWinsOverEarlierManagerRow()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var managerId = await app.AddMusicianAsync("Mario", "Manager");
        var managedGroupId = await app.AddGroupAsync(ownerId: 1);
        await AddMemberAsync(app, managedGroupId, managerId, GroupMemberRole.Manager, GroupMembershipTestHarness.Now);

        var managed = await ManagedGroup(app, managerId);
        Assert.True(managed.IsSuccess, managed.Error);
        Assert.Equal(managedGroupId, managed.Value!.Id);

        var ownedGroupId = await app.AddGroupAsync(ownerId: managerId);
        await AddMemberAsync(app, ownedGroupId, managerId, GroupMemberRole.Owner, GroupMembershipTestHarness.Now.AddDays(1));

        managed = await ManagedGroup(app, managerId);
        Assert.Equal(ownedGroupId, managed.Value!.Id);
        var memberships = await Memberships(app, managerId);
        Assert.Equal([GroupMemberRole.Owner, GroupMemberRole.Manager], memberships.Select(m => m.Role));
    }

    [Fact]
    public async Task SameRole_OrderedByJoinedAtAscending()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var userId = await app.AddMusicianAsync("Sara", "Several");
        var laterGroupId = await app.AddGroupAsync(ownerId: 1);
        var earlierGroupId = await app.AddGroupAsync(ownerId: 1);
        await AddMemberAsync(app, laterGroupId, userId, GroupMemberRole.Manager, GroupMembershipTestHarness.Now);
        await AddMemberAsync(app, earlierGroupId, userId, GroupMemberRole.Manager, GroupMembershipTestHarness.Now.AddMonths(-3));

        var managed = await ManagedGroup(app, userId);
        Assert.Equal(earlierGroupId, managed.Value!.Id);
        Assert.Equal([earlierGroupId, laterGroupId], (await Memberships(app, userId)).Select(m => m.GroupId));
    }

    [Fact]
    public async Task NoMemberships_EmptyList()
    {
        await using var app = GroupMembershipTestHarness.Create(_fixture);
        var userId = await app.AddMusicianAsync("Nadia", "Nobody");

        Assert.Empty(await Memberships(app, userId));
    }
}
