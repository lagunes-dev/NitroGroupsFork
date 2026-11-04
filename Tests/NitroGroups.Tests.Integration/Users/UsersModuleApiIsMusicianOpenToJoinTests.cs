using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Adapters;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Core.Users.Infrastructure.Repositories;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Users;

/// <summary>
/// S2: el módulo Groups solo puede invitar a músicos abiertos a unirse. Esta consulta es la
/// única puerta a <c>IsOpenToJoin</c> y un cliente nunca pasa, aunque tenga perfil de músico.
/// </summary>
public class UsersModuleApiIsMusicianOpenToJoinTests(IntegrationTestFixture fixture)
    : IClassFixture<IntegrationTestFixture>
{
    private static IUsersModuleApi CreateApi(UsersDbContext context)
        => new UsersModuleApi(context, new OpenMusicianSearchRepository(context));

    private static long AddUser(UsersDbContext context, string firstName, UserType userType, bool active = true)
    {
        var user = new User(
            $"auth0|{Guid.NewGuid():N}",
            $"{firstName}.{Guid.NewGuid():N}@example.com".ToLowerInvariant(),
            firstName,
            "Prueba",
            userType);
        context.Users.Add(user);

        if (!active)
            context.Entry(user).Property(u => u.Active).CurrentValue = false;

        context.SaveChanges();
        return user.Id;
    }

    private static void AddMusicianProfile(UsersDbContext context, long userId, bool isOpenToJoin)
    {
        context.Musicians.Add(new Musician { UserId = userId, IsOpenToJoin = isOpenToJoin });
        context.SaveChanges();
    }

    [Fact]
    public async Task MusicoAbiertoYActivo_ReturnsTrue()
    {
        await using var context = fixture.CreateUsersContext();
        var userId = AddUser(context, "Ana", UserType.Musician);
        AddMusicianProfile(context, userId, isOpenToJoin: true);

        Assert.True(await CreateApi(context).IsMusicianOpenToJoinAsync(userId));
    }

    [Fact]
    public async Task MusicoCerrado_ReturnsFalse()
    {
        await using var context = fixture.CreateUsersContext();
        var userId = AddUser(context, "Beto", UserType.Musician);
        AddMusicianProfile(context, userId, isOpenToJoin: false);

        Assert.False(await CreateApi(context).IsMusicianOpenToJoinAsync(userId));
    }

    [Fact]
    public async Task ClienteSinPerfilDeMusico_ReturnsFalse()
    {
        await using var context = fixture.CreateUsersContext();
        var userId = AddUser(context, "Carla", UserType.Client);

        Assert.False(await CreateApi(context).IsMusicianOpenToJoinAsync(userId));
    }

    [Fact]
    public async Task ClienteConPerfilDeMusicoAbierto_ReturnsFalse()
    {
        await using var context = fixture.CreateUsersContext();
        var userId = AddUser(context, "Dario", UserType.Client);
        AddMusicianProfile(context, userId, isOpenToJoin: true);

        Assert.False(await CreateApi(context).IsMusicianOpenToJoinAsync(userId));
    }

    [Fact]
    public async Task MusicoAbiertoPeroConCuentaInactiva_ReturnsFalse()
    {
        await using var context = fixture.CreateUsersContext();
        var userId = AddUser(context, "Elena", UserType.Musician, active: false);
        AddMusicianProfile(context, userId, isOpenToJoin: true);

        Assert.False(await CreateApi(context).IsMusicianOpenToJoinAsync(userId));
    }
}
