using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetTeam;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
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
/// El equipo del grupo (<c>GET api/groups/{groupId}/team</c>): solo las filas activas, con el nombre
/// y la foto que salen del módulo Users, el rol como texto y el orden Owner, Manager, Member y,
/// dentro del mismo rol, la membresía más antigua primero.
/// </summary>
public class GroupTeamQueryHandlerIntegrationTests : IClassFixture<IntegrationTestFixture>, IAsyncDisposable
{
    private static readonly DateTime Now = new(2026, 11, 4, 18, 0, 0, DateTimeKind.Utc);

    private readonly GroupsDbContext _groups;
    private readonly UsersDbContext _users;
    private readonly IUnitOfWorkGroups _unitOfWork;
    private readonly IUsersModuleApi _usersApi;

    public GroupTeamQueryHandlerIntegrationTests(IntegrationTestFixture fixture)
    {
        _groups = fixture.CreateGroupsContext();
        _users = fixture.CreateUsersContext();
        _unitOfWork = fixture.CreateGroupsUnitOfWork(_groups);
        _usersApi = new UsersModuleApi(_users, new OpenMusicianSearchRepository(_users));
    }

    private Task<GroupsResult<List<GroupTeamMemberResponse>>> TeamAsync(long groupId)
        => new GetGroupTeamQueryHandler(_unitOfWork, _usersApi)
            .Handle(new GetGroupTeamQuery(groupId), CancellationToken.None);

    [Fact]
    public async Task EquipoDelGrupo_DevuelveSoloLosActivosConNombreRolYElOrdenDocumentado()
    {
        var groupId = await AddGroupAsync();
        var ownerId = await AddUserAsync("Olga", "Ortiz", "olga@example.com", "https://cdn.example.com/olga.jpg");
        var managerId = await AddUserAsync("Mario", "Mora", "mario@example.com");
        var olderMemberId = await AddUserAsync("Mateo", "Ruiz", "mateo@example.com");
        var newerMemberId = await AddUserAsync("Nadia", "Nava", "nadia@example.com");
        var formerMemberId = await AddUserAsync("Ines", "Ibarra", "ines@example.com");

        // El manager y los miembros entraron antes que el owner: el rol manda sobre la fecha.
        await AddMemberAsync(groupId, managerId, GroupMemberRole.Manager, Now.AddMonths(-6));
        await AddMemberAsync(groupId, ownerId, GroupMemberRole.Owner, Now.AddMonths(-1));
        await AddMemberAsync(groupId, newerMemberId, GroupMemberRole.Member, Now.AddDays(-2));
        await AddMemberAsync(groupId, olderMemberId, GroupMemberRole.Member, Now.AddMonths(-9));
        // Ya salió del grupo: la fila queda con IsActive = false.
        await AddMemberAsync(groupId, formerMemberId, GroupMemberRole.Member, Now.AddYears(-2), active: false);
        // La membresía de otro grupo no se mezcla.
        var otherGroupId = await AddGroupAsync(ownerId: 999);
        await AddMemberAsync(otherGroupId, formerMemberId, GroupMemberRole.Member, Now);

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(
            [
                (ownerId, "Olga Ortiz", "Owner", (string?)"https://cdn.example.com/olga.jpg", Now.AddMonths(-1)),
                (managerId, "Mario Mora", "Manager", null, Now.AddMonths(-6)),
                (olderMemberId, "Mateo Ruiz", "Member", null, Now.AddMonths(-9)),
                (newerMemberId, "Nadia Nava", "Member", null, Now.AddDays(-2))
            ],
            result.Value!.Select(row => (row.UserId, row.FullName, row.Role, row.ProfilePictureUrl, row.JoinedAt)));
        Assert.All(result.Value!, row => Assert.DoesNotContain("@", row.FullName));
    }

    [Fact]
    public async Task MiembroQueYaSalio_NoApareceEnElEquipo()
    {
        var groupId = await AddGroupAsync();
        var ownerId = await AddUserAsync("Olga", "Ortiz", "olga@example.com");
        var formerMemberId = await AddUserAsync("Ines", "Ibarra", "ines@example.com");
        await AddMemberAsync(groupId, ownerId, GroupMemberRole.Owner, Now);
        await AddMemberAsync(groupId, formerMemberId, GroupMemberRole.Member, Now.AddYears(-3), active: false);

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal([ownerId], result.Value!.Select(row => row.UserId));
    }

    [Fact]
    public async Task SinNombre_UsaLaParteLocalDelEmail_SinArroba()
    {
        var groupId = await AddGroupAsync();
        var noNameId = await AddUserAsync(string.Empty, string.Empty, "sin-nombre@example.com");
        await AddMemberAsync(groupId, noNameId, GroupMemberRole.Member, Now);

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        var row = Assert.Single(result.Value!);
        Assert.Equal("sin-nombre", row.FullName);
        Assert.DoesNotContain("@", row.FullName);
        Assert.Null(row.ProfilePictureUrl);
    }

    [Fact]
    public async Task UserId_EsElMismoIdConElQueSeConsultaElPerfilPublicoDelMusico()
    {
        // El perfil público (/musicians/{userId}) se busca por el id del usuario: la fila del equipo
        // expone ese mismo id y no otro.
        var groupId = await AddGroupAsync();
        var musicianId = await AddUserAsync("Mateo", "Ruiz", "mateo@example.com");
        await AddMemberAsync(groupId, musicianId, GroupMemberRole.Member, Now);

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        var row = Assert.Single(result.Value!);
        Assert.Equal(musicianId, row.UserId);
        Assert.Contains(_users.Musicians, musician => musician.UserId == row.UserId);
    }

    [Fact]
    public async Task GrupoSinMiembrosActivos_DevuelveListaVacia()
    {
        var groupId = await AddGroupAsync();

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Empty(result.Value!);
    }

    [Fact]
    public async Task GrupoInexistente_DevuelveNoEncontrado()
    {
        var result = await TeamAsync(404_404);

        Assert.True(result.IsFailure);
        Assert.Equal(GroupsErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Grupo no encontrado.", result.Error);
    }

    [Fact]
    public async Task EquipoDelGrupo_LlevaInstrumentoYCiudadDeCadaMusico_SinInventarLosQueFaltan()
    {
        var groupId = await AddGroupAsync();
        var withData = await AddUserAsync(
            "Beto", "Bravo", "beto@example.com", instruments: "Bajo", city: "Guadalajara, Jalisco");
        var withoutData = await AddUserAsync("Nadia", "Nava", "nadia.sola@example.com");
        await AddMemberAsync(groupId, withData, GroupMemberRole.Member, Now.AddDays(-2));
        await AddMemberAsync(groupId, withoutData, GroupMemberRole.Member, Now.AddDays(-1));

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess);
        var beto = result.Value.Single(row => row.UserId == withData);
        Assert.Equal("Bajo", beto.Instruments);
        Assert.Equal("Guadalajara, Jalisco", beto.City);

        // Un músico sin perfil cargado no rompe el renglón ni rellena el hueco con nada.
        var nadia = result.Value.Single(row => row.UserId == withoutData);
        Assert.Null(nadia.Instruments);
        Assert.Null(nadia.City);
        Assert.Equal("Nadia Nava", nadia.FullName);
    }

    private async Task<long> AddGroupAsync(long ownerId = 10)    {
        var group = new Group
        {
            OwnerUserId = ownerId,
            Slug = $"grupo-{Guid.NewGuid():N}",
            GroupName = "Los Test",
            Currency = "MXN",
            Active = true
        };
        _groups.Groups.Add(group);
        await _groups.SaveChangesAsync();
        return group.Id;
    }

    private async Task<long> AddUserAsync(
        string firstName, string lastName, string email, string? profilePictureUrl = null,
        string? instruments = null, string? city = null)
    {
        var user = new User($"auth0|{Guid.NewGuid():N}", email, firstName, lastName, UserType.Musician);
        if (profilePictureUrl is not null)
            user.UpdateProfilePicture(profilePictureUrl);

        _users.Users.Add(user);
        await _users.SaveChangesAsync();

        _users.Musicians.Add(new Musician
        {
            UserId = user.Id,
            IsOpenToJoin = true,
            Instruments = instruments,
            City = city
        });
        await _users.SaveChangesAsync();
        return user.Id;
    }

    private async Task AddMemberAsync(
        long groupId, long userId, GroupMemberRole role, DateTime joinedAt, bool active = true)
    {
        _groups.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = active,
            JoinedAt = joinedAt,
            LeftAt = active ? null : joinedAt.AddDays(30),
            JoinedVia = JoinedVia.Manual
        });
        await _groups.SaveChangesAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _groups.DisposeAsync();
        await _users.DisposeAsync();
    }
}
