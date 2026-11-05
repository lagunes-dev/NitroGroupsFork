using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetPublicTeam;
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
/// El equipo público del grupo (S14): solo membresías activas, en el orden de siempre (Owner,
/// Manager, Member y la más antigua primero), con nombre, rol e instrumento · ciudad, sin correos.
/// Quien cerró su perfil aparece con nombre y rol pero sin instrumento ni ciudad, y quien no cargó
/// nada aparece vacío: el renglón nunca se rellena con un dato inventado.
/// </summary>
public class PublicGroupTeamQueryHandlerIntegrationTests : IClassFixture<IntegrationTestFixture>, IAsyncDisposable
{
    private static readonly DateTime Now = new(2026, 11, 4, 18, 0, 0, DateTimeKind.Utc);

    private readonly GroupsDbContext _groups;
    private readonly UsersDbContext _users;
    private readonly IUnitOfWorkGroups _unitOfWork;
    private readonly IUsersModuleApi _usersApi;

    public PublicGroupTeamQueryHandlerIntegrationTests(IntegrationTestFixture fixture)
    {
        _groups = fixture.CreateGroupsContext();
        _users = fixture.CreateUsersContext();
        _unitOfWork = fixture.CreateGroupsUnitOfWork(_groups);
        _usersApi = new UsersModuleApi(_users, new OpenMusicianSearchRepository(_users));
    }

    private Task<GroupsResult<List<PublicGroupTeamMemberResponse>>> TeamAsync(long groupId)
        => new GetPublicGroupTeamQueryHandler(_unitOfWork, _usersApi)
            .Handle(new GetPublicGroupTeamQuery(groupId), CancellationToken.None);

    [Fact]
    public async Task SoloLosActivos_EnElOrdenDelEquipo_ConNombreRolEInstrumentoYCiudad()
    {
        var groupId = await AddGroupAsync();
        var ownerId = await AddUserAsync("Olga", "Ortiz", "olga@example.com", "Guitarra", "Guadalajara, Jalisco");
        var managerId = await AddUserAsync("Mario", "Mora", "mario@example.com", "Bajo", "Zapopan, Jalisco");
        var olderMemberId = await AddUserAsync("Mateo", "Ruiz", "mateo@example.com", "Batería", null);
        var newerMemberId = await AddUserAsync("Nadia", "Nava", "nadia@example.com", null, "Tlaquepaque, Jalisco");
        var formerMemberId = await AddUserAsync("Ines", "Ibarra", "ines@example.com", "Voz", "Tonalá, Jalisco");

        await AddMemberAsync(groupId, managerId, GroupMemberRole.Manager, Now.AddMonths(-6));
        await AddMemberAsync(groupId, ownerId, GroupMemberRole.Owner, Now.AddMonths(-1));
        await AddMemberAsync(groupId, newerMemberId, GroupMemberRole.Member, Now.AddDays(-2));
        await AddMemberAsync(groupId, olderMemberId, GroupMemberRole.Member, Now.AddMonths(-9));
        // Ya salió del grupo: el perfil público no lo muestra.
        await AddMemberAsync(groupId, formerMemberId, GroupMemberRole.Member, Now.AddYears(-2), active: false);
        // La membresía de otro grupo no se mezcla.
        var otherGroupId = await AddGroupAsync(ownerId: 999);
        await AddMemberAsync(otherGroupId, formerMemberId, GroupMemberRole.Member, Now);

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(
            [
                (ownerId, "Olga Ortiz", "Owner", (string?)"Guitarra", (string?)"Guadalajara, Jalisco"),
                (managerId, "Mario Mora", "Manager", "Bajo", "Zapopan, Jalisco"),
                (olderMemberId, "Mateo Ruiz", "Member", "Batería", null),
                (newerMemberId, "Nadia Nava", "Member", null, "Tlaquepaque, Jalisco")
            ],
            result.Value!.Select(row => (row.UserId, row.FullName, row.Role, row.Instruments, row.City)));
        // La respuesta es pública: ningún nombre puede arrastrar un correo.
        Assert.All(result.Value!, row =>
        {
            Assert.DoesNotContain("@", row.FullName);
            Assert.DoesNotContain("@", row.Instruments ?? string.Empty);
            Assert.DoesNotContain("@", row.City ?? string.Empty);
        });
    }

    [Fact]
    public async Task PerfilCerrado_ApareceConNombreYRol_SinInstrumentoNiCiudad()
    {
        var groupId = await AddGroupAsync();
        var openId = await AddUserAsync("Beto", "Bravo", "beto@example.com", "Bajo", "Guadalajara, Jalisco");
        // Cerró su perfil: no recibe invitaciones, así que su oficio tampoco se publica.
        var closedId = await AddUserAsync("Nadia", "Nava", "nadia@example.com", "Teclados", "Zapopan, Jalisco", openToJoin: false);
        await AddMemberAsync(groupId, openId, GroupMemberRole.Member, Now.AddDays(-2));
        await AddMemberAsync(groupId, closedId, GroupMemberRole.Member, Now.AddDays(-1));

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        var open = result.Value!.Single(row => row.UserId == openId);
        Assert.Equal("Bajo", open.Instruments);
        Assert.Equal("Guadalajara, Jalisco", open.City);

        // El perfil cerrado sigue siendo parte del equipo: nombre y rol, y el oficio se calla.
        var closed = result.Value!.Single(row => row.UserId == closedId);
        Assert.Equal("Nadia Nava", closed.FullName);
        Assert.Equal("Member", closed.Role);
        Assert.Null(closed.Instruments);
        Assert.Null(closed.City);
    }

    [Fact]
    public async Task MiembroSinDatosCargados_SaleVacio_SinInventarNada()
    {
        var groupId = await AddGroupAsync();
        // Un miembro sin perfil de músico y otro sin nombre en la fila de usuario.
        var noProfileId = await AddUserWithoutProfileAsync("Nadia", "Nava", "nadia@example.com");
        var noNameId = await AddUserAsync(string.Empty, string.Empty, "sin-nombre@example.com");
        await AddMemberAsync(groupId, noProfileId, GroupMemberRole.Member, Now.AddDays(-2));
        await AddMemberAsync(groupId, noNameId, GroupMemberRole.Member, Now.AddDays(-1));

        var result = await TeamAsync(groupId);

        Assert.True(result.IsSuccess, result.Error);
        var noProfile = result.Value!.Single(row => row.UserId == noProfileId);
        Assert.Equal("Nadia Nava", noProfile.FullName);
        Assert.Equal("Member", noProfile.Role);
        Assert.Null(noProfile.Instruments);
        Assert.Null(noProfile.City);

        // Sin nombre no se rellena con la parte local del correo: el renglón queda vacío.
        var noName = result.Value!.Single(row => row.UserId == noNameId);
        Assert.Equal(string.Empty, noName.FullName);
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

    private async Task<long> AddGroupAsync(long ownerId = 10)
    {
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
        string firstName, string lastName, string email,
        string? instruments = null, string? city = null, bool openToJoin = true)
    {
        var userId = await AddUserWithoutProfileAsync(firstName, lastName, email);

        _users.Musicians.Add(new Musician
        {
            UserId = userId,
            IsOpenToJoin = openToJoin,
            Instruments = instruments,
            City = city
        });
        await _users.SaveChangesAsync();
        return userId;
    }

    private async Task<long> AddUserWithoutProfileAsync(string firstName, string lastName, string email)
    {
        var user = new User($"auth0|{Guid.NewGuid():N}", email, firstName, lastName, UserType.Musician);
        _users.Users.Add(user);
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
