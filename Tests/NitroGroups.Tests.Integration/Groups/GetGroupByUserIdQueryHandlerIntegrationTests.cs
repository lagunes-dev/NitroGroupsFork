using AutoMapper;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetByUserId;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Adapters;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Core.Users.Infrastructure.Repositories;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// El grupo que el usuario administra (<c>GET api/users/{userId}/groups</c>), que solo cuenta filas
/// activas de Owner/Manager. Un usuario que existe y todavía no tiene grupo propio se responde con
/// "sin grupo" (success con null), no con un error: el 404 queda para el usuario que no existe.
/// </summary>
public class GetGroupByUserIdQueryHandlerIntegrationTests : IClassFixture<IntegrationTestFixture>, IAsyncDisposable
{
    private readonly GroupsDbContext _groups;
    private readonly UsersDbContext _users;
    private readonly IUnitOfWorkGroups _unitOfWork;
    private readonly IUsersModuleApi _usersApi;
    private readonly IMapper _mapper;

    public GetGroupByUserIdQueryHandlerIntegrationTests(IntegrationTestFixture fixture)
    {
        _groups = fixture.CreateGroupsContext();
        _users = fixture.CreateUsersContext();
        _unitOfWork = fixture.CreateGroupsUnitOfWork(_groups);
        _usersApi = new UsersModuleApi(_users, new OpenMusicianSearchRepository(_users));
        _mapper = fixture.CreateMapper();
    }

    private Task<Result<GroupResponse?>> ManagedGroupAsync(long userId)
        => new GetGroupByUserIdQueryHandler(_unitOfWork, _mapper, _usersApi)
            .Handle(new GetGroupByUserIdQuery(userId), CancellationToken.None);

    [Fact]
    public async Task Handle_CuandoExisteGrupoDelUsuario_DeberiaRetornarlo()
    {
        var userId = await AddUserAsync("Olga", "Ortiz");
        var group = await AddGroupAsync(userId);
        await AddMemberAsync(group.Id, userId, GroupMemberRole.Owner);

        var result = await ManagedGroupAsync(userId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.NotNull(result.Value);
        Assert.Equal("grupo-del-usuario", result.Value!.Slug);
    }

    [Fact]
    public async Task Handle_CuandoElUsuarioExisteSinGrupo_DeberiaRetornarSuccessSinGrupo()
    {
        var userId = await AddUserAsync("Nadia", "Nava");

        var result = await ManagedGroupAsync(userId);

        // "Sin grupo" es una respuesta: el endpoint contesta 200 con null y el front lo lee así.
        Assert.True(result.IsSuccess, result.Error);
        Assert.Null(result.Value);
    }

    [Fact]
    public async Task Handle_CuandoElUsuarioNoExiste_DeberiaRetornarFailure()
    {
        var result = await ManagedGroupAsync(999);

        // El 404 de verdad: un usuario que no está en el padrón.
        Assert.True(result.IsFailure);
        Assert.Equal("No se encontro ningun usuario con ese id", result.Error);
    }

    private async Task<long> AddUserAsync(string firstName, string lastName)
    {
        var user = new User(
            $"auth0|{Guid.NewGuid():N}",
            $"{firstName}.{Guid.NewGuid():N}@example.com".ToLowerInvariant(),
            firstName,
            lastName,
            UserType.Musician);
        _users.Users.Add(user);
        await _users.SaveChangesAsync();
        return user.Id;
    }

    private async Task<Group> AddGroupAsync(long ownerId)
    {
        var group = new Group
        {
            OwnerUserId = ownerId,
            Slug = "grupo-del-usuario",
            GroupName = "Grupo del Usuario",
            Active = true,
            IsAcceptingBookings = true,
            Currency = "MXN",
            Email = "grupo@example.com",
            Phone = "5559990000"
        };
        _groups.Groups.Add(group);
        await _groups.SaveChangesAsync();
        return group;
    }

    private async Task AddMemberAsync(long groupId, long userId, GroupMemberRole role)
    {
        _groups.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = true,
            JoinedAt = DateTime.UtcNow,
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
