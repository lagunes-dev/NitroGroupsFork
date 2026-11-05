using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.GetMine;
using NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.Record;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Core.Groups.Infrastructure.Repositories;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Adapters;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Core.Users.Infrastructure.Repositories;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// S9: una visita por (músico, grupo), no una por clic. El manager que abre el perfil deja la
/// visita, refrescar solo mueve la fecha, y el músico lee cuántos grupos lo miraron y sus nombres.
/// </summary>
public class ProfileVisitIntegrationTests : IClassFixture<IntegrationTestFixture>, IAsyncDisposable
{
    private static readonly DateTime Now = new(2026, 11, 4, 18, 0, 0, DateTimeKind.Utc);

    private readonly GroupsDbContext _groups;
    private readonly UsersDbContext _users;
    private readonly IUnitOfWorkGroups _unitOfWork;
    private readonly IProfileVisitRepository _visits;
    private readonly IUsersModuleApi _usersApi;
    private readonly IGroupsModuleApi _groupsApi;

    public ProfileVisitIntegrationTests(IntegrationTestFixture fixture)
    {
        _groups = fixture.CreateGroupsContext();
        _users = fixture.CreateUsersContext();
        _unitOfWork = fixture.CreateGroupsUnitOfWork(_groups);
        _visits = new ProfileVisitRepository(_groups);
        _usersApi = new UsersModuleApi(_users, new OpenMusicianSearchRepository(_users));
        _groupsApi = new GroupsModuleApi(_groups);
    }

    private Task<GroupsResult<bool>> VisitAsync(long groupId, long musicianUserId, long viewerUserId)
        => new RecordProfileVisitCommandHandler(_unitOfWork, _visits, _usersApi, _groupsApi)
            .Handle(new RecordProfileVisitCommand(groupId, musicianUserId, viewerUserId), CancellationToken.None);

    private Task<GroupsResult<ProfileVisitsResponse>> MineAsync(long musicianUserId)
        => new GetMyProfileVisitsQueryHandler(_unitOfWork, _visits)
            .Handle(new GetMyProfileVisitsQuery(musicianUserId), CancellationToken.None);

    private async Task<long> AddGroupAsync(string groupName, bool active = true)
    {
        var group = new Group
        {
            OwnerUserId = 900,
            Slug = $"grupo-{Guid.NewGuid():N}",
            GroupName = groupName,
            Currency = "MXN",
            Active = active
        };
        _groups.Groups.Add(group);
        await _groups.SaveChangesAsync();
        return group.Id;
    }

    private async Task<long> AddMusicianAsync(string firstName)
    {
        var user = new User($"auth0|{Guid.NewGuid():N}", $"{firstName}.{Guid.NewGuid():N}@example.com".ToLowerInvariant(), firstName, "Prueba", UserType.Musician);
        _users.Users.Add(user);
        await _users.SaveChangesAsync();
        _users.Musicians.Add(new Musician { UserId = user.Id, IsOpenToJoin = true });
        await _users.SaveChangesAsync();
        return user.Id;
    }

    private async Task AddMemberAsync(long groupId, long userId, GroupMemberRole role)
    {
        _groups.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = true,
            JoinedAt = Now.AddMonths(-3),
            JoinedVia = JoinedVia.Manual
        });
        await _groups.SaveChangesAsync();
    }

    private async Task AddVisitAsync(long groupId, long musicianUserId, DateTime visitedAt)
    {
        _groups.GroupProfileVisits.Add(GroupProfileVisit.Create(groupId, musicianUserId, visitedAt));
        await _groups.SaveChangesAsync();
    }

    [Fact]
    public async Task DosVisitasDelMismoGrupo_DejanUnaVisita_YMuevenLaFecha()
    {
        var groupId = await AddGroupAsync("Los Vargas");
        var managerId = await AddMusicianAsync("Mateo");
        await AddMemberAsync(groupId, managerId, GroupMemberRole.Manager);
        var musicianId = await AddMusicianAsync("Miguel");

        var first = await VisitAsync(groupId, musicianId, managerId);
        var rowsAfterFirst = await _groups.GroupProfileVisits.AsNoTracking().Where(v => v.MusicianUserId == musicianId).ToListAsync();
        var visitedFirst = Assert.Single(rowsAfterFirst).LastVisitedAt;

        // Refrescar el perfil es la misma visita: no infla el conteo, solo mueve la fecha.
        var second = await VisitAsync(groupId, musicianId, managerId);

        Assert.True(first.IsSuccess, first.Error);
        Assert.True(second.IsSuccess, second.Error);
        var rows = await _groups.GroupProfileVisits.AsNoTracking().Where(v => v.MusicianUserId == musicianId).ToListAsync();
        var visit = Assert.Single(rows);
        Assert.Equal(groupId, visit.GroupId);
        Assert.True(visit.LastVisitedAt >= visitedFirst);

        var mine = await MineAsync(musicianId);
        Assert.True(mine.IsSuccess, mine.Error);
        Assert.Equal(1, mine.Value!.Count);
        Assert.Single(mine.Value!.Groups);
    }

    [Fact]
    public async Task AutoVisita_NoSeRegistra()
    {
        var groupId = await AddGroupAsync("Los Vargas");
        var managerId = await AddMusicianAsync("Mateo");
        await AddMemberAsync(groupId, managerId, GroupMemberRole.Manager);

        var result = await VisitAsync(groupId, managerId, managerId);

        Assert.False(result.IsSuccess);
        Assert.Equal(GroupsErrorKind.Validation, result.ErrorKind);
        Assert.Empty(await _groups.GroupProfileVisits.AsNoTracking().ToListAsync());
        Assert.Empty((await MineAsync(managerId)).Value!.Groups);
    }

    [Fact]
    public async Task VisitaSinAdministrarElGrupo_NoSeRegistra()
    {
        var groupId = await AddGroupAsync("Los Vargas");
        var memberId = await AddMusicianAsync("Olga");
        await AddMemberAsync(groupId, memberId, GroupMemberRole.Member);
        var musicianId = await AddMusicianAsync("Miguel");

        // Ser miembro del grupo no alcanza: solo Owner y Manager dejan visita.
        var member = await VisitAsync(groupId, musicianId, memberId);
        // Y quien no tiene nada que ver con el grupo tampoco.
        var strangerId = await AddMusicianAsync("Nadia");
        var stranger = await VisitAsync(groupId, musicianId, strangerId);

        Assert.False(member.IsSuccess);
        Assert.Equal(GroupsErrorKind.Forbidden, member.ErrorKind);
        Assert.False(stranger.IsSuccess);
        Assert.Equal(GroupsErrorKind.Forbidden, stranger.ErrorKind);
        Assert.Empty(await _groups.GroupProfileVisits.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task MusicoSinVisitas_LeeCeroYNadaQueListar_SinError()
    {
        var musicianId = await AddMusicianAsync("Miguel");

        var mine = await MineAsync(musicianId);

        Assert.True(mine.IsSuccess, mine.Error);
        Assert.Equal(0, mine.Value!.Count);
        Assert.Empty(mine.Value.Groups);
    }

    [Fact]
    public async Task Musico_LeeSuConteoYLosNombres_LosMasNuevosPrimero()
    {
        var musicianId = await AddMusicianAsync("Miguel");
        var olderGroupId = await AddGroupAsync("Mariachi Oro");
        var newerGroupId = await AddGroupAsync("Los Vargas");
        var closedGroupId = await AddGroupAsync("Trio Sin Cartel", active: false);

        await AddVisitAsync(olderGroupId, musicianId, Now.AddDays(-3));
        await AddVisitAsync(newerGroupId, musicianId, Now.AddMinutes(-5));
        // El grupo dejó de ser público después de la visita: su nombre ya no se muestra.
        await AddVisitAsync(closedGroupId, musicianId, Now.AddMinutes(-1));

        var mine = await MineAsync(musicianId);

        Assert.True(mine.IsSuccess, mine.Error);
        var response = mine.Value!;
        Assert.Equal(2, response.Count);
        // Los más nuevos primero, con nombre y slug para enlazar al perfil público del grupo.
        Assert.Equal(
            [(newerGroupId, "Los Vargas", Now.AddMinutes(-5)), (olderGroupId, "Mariachi Oro", Now.AddDays(-3))],
            response.Groups.Select(g => (g.Id, g.GroupName, g.LastVisitedAt)));
        Assert.All(response.Groups, group => Assert.StartsWith("grupo-", group.Slug));
        Assert.DoesNotContain(response.Groups, group => group.Id == closedGroupId);
    }

    public async ValueTask DisposeAsync()
    {
        await _groups.DisposeAsync();
        await _users.DisposeAsync();
    }
}
