using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Respond;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Adapters;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Core.Users.Infrastructure.Repositories;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Bookings;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// Contextos en memoria + los adaptadores reales de cada módulo, para ejercer los casos de uso de
/// membresía de punta a punta (incluida la puerta <c>IsOpenToJoin</c> del módulo Users).
/// La parte de "pedir unirse" y las bandejas está en <c>GroupMembershipJoinRequestsHarness</c>.
/// </summary>
internal sealed partial class GroupMembershipTestHarness : IAsyncDisposable
{
    internal const long OwnerId = 10;
    internal const long ManagerId = 11;
    internal const long StrangerId = 99;

    internal static readonly DateTime Now = new(2026, 11, 4, 18, 0, 0, DateTimeKind.Utc);

    private static readonly DateTimeOffset FixedNow = new(2026, 11, 4, 18, 0, 0, TimeSpan.Zero);

    private readonly GroupsDbContext _groups;
    private readonly UsersDbContext _users;

    private GroupMembershipTestHarness(GroupsDbContext groups, UsersDbContext users, IntegrationTestFixture fixture)
    {
        _groups = groups;
        _users = users;
        UnitOfWork = fixture.CreateGroupsUnitOfWork(groups);
        Users = new UsersModuleApi(users, new OpenMusicianSearchRepository(users));
        GroupsApi = new GroupsModuleApi(groups);
        Time = new FixedTimeProvider(FixedNow);
    }

    internal IUnitOfWorkGroups UnitOfWork { get; }
    internal IUsersModuleApi Users { get; }
    internal IGroupsModuleApi GroupsApi { get; }
    internal TimeProvider Time { get; }

    internal static GroupMembershipTestHarness Create(IntegrationTestFixture fixture)
        => new(fixture.CreateGroupsContext(), fixture.CreateUsersContext(), fixture);

    internal Task<GroupsResult<GroupMembershipRequestResponse>> Invite(InviteMusicianCommand command)
        => new InviteMusicianCommandHandler(UnitOfWork, Users).Handle(command, CancellationToken.None);

    internal Task<GroupsResult<GroupMembershipRequestResponse>> Respond(RespondToMembershipRequestCommand command)
        => new RespondToMembershipRequestCommandHandler(UnitOfWork, GroupsApi, Users, Time)
            .Handle(command, CancellationToken.None);

    internal async Task<long> AddGroupAsync(bool active = true, long ownerId = OwnerId)
    {
        var group = new Group
        {
            OwnerUserId = ownerId,
            Slug = $"grupo-{Guid.NewGuid():N}",
            GroupName = "Los Test",
            Currency = "MXN",
            Active = active
        };
        _groups.Groups.Add(group);
        await _groups.SaveChangesAsync();
        return group.Id;
    }

    internal async Task<long> AddUserAsync(string firstName, string lastName, UserType userType, bool active = true)
    {
        var user = new User(
            $"auth0|{Guid.NewGuid():N}",
            $"{firstName}.{Guid.NewGuid():N}@example.com".ToLowerInvariant(),
            firstName,
            lastName,
            userType);
        _users.Users.Add(user);

        if (!active)
            _users.Entry(user).Property(u => u.Active).CurrentValue = false;

        await _users.SaveChangesAsync();
        return user.Id;
    }

    internal async Task<long> AddMusicianAsync(
        string firstName,
        string lastName,
        bool openToJoin = true,
        bool active = true)
    {
        var userId = await AddUserAsync(firstName, lastName, UserType.Musician, active);
        _users.Musicians.Add(new Musician { UserId = userId, IsOpenToJoin = openToJoin });
        await _users.SaveChangesAsync();
        return userId;
    }

    internal async Task AddMemberAsync(
        long groupId,
        long userId,
        GroupMemberRole role,
        bool active = true,
        DateTime? leftAt = null)
    {
        _groups.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = active,
            JoinedAt = Now.AddYears(-1),
            LeftAt = leftAt,
            JoinedVia = JoinedVia.Manual
        });
        await _groups.SaveChangesAsync();
    }

    internal Task<List<GroupMembershipRequest>> RequestsAsync()
        => _groups.GroupMembershipRequests.ToListAsync();

    internal Task<List<GroupMember>> MembersAsync(long groupId)
        => _groups.GroupMembers.Where(m => m.GroupId == groupId).ToListAsync();

    public async ValueTask DisposeAsync()
    {
        await _groups.DisposeAsync();
        await _users.DisposeAsync();
    }
}
