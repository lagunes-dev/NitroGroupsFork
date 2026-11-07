using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Core.Users.Application.UseCases.Musicians.UpdateMyProfile;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Users;

/// <summary>
/// S3, S4: a musician edits only their own profile. The user id comes from the command (the token
/// at the HTTP layer); the body can never pick another account. Fields left out are kept.
/// </summary>
public class UpdateMyMusicianProfileCommandHandlerIntegrationTests(IntegrationTestFixture fixture)
    : IClassFixture<IntegrationTestFixture>
{
    [Fact]
    public async Task OnlyTheCallersProfileChanges()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var callerId = AddUser(users, "Mateo", UserType.Musician);
        AddMusician(users, callerId, headline: "Headline viejo");
        var otherId = AddUser(users, "Otro", UserType.Musician);
        AddMusician(users, otherId, headline: "Headline del otro");

        var result = await Handler(users, groups).Handle(
            new UpdateMyMusicianProfileCommand(callerId, Headline: "Headline nuevo", null, null, null, null, null),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal("Headline nuevo", result.Value!.Headline);
        Assert.Equal(callerId, result.Value.UserId);

        Assert.Equal("Headline nuevo", MusicianOf(users, callerId).Headline);
        Assert.Equal("Headline del otro", MusicianOf(users, otherId).Headline);
    }

    [Fact]
    public async Task PartialUpdate_KeepsEveryFieldLeftOutOfTheRequest()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var userId = AddUser(users, "Mateo", UserType.Musician);
        AddMusician(users, userId,
            headline: "Guitarrista de sesión",
            shortBio: "Toco desde los 12.",
            instruments: "Guitarra, bajo",
            years: 12,
            videoUrl: "https://youtu.be/xyz",
            isOpenToJoin: true);

        var result = await Handler(users, groups).Handle(
            new UpdateMyMusicianProfileCommand(userId, Headline: "Productor", null, null, null, null, null),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var profile = result.Value!;
        Assert.Equal("Productor", profile.Headline);
        Assert.Equal("Toco desde los 12.", profile.ShortBio);
        Assert.Equal("Guitarra, bajo", profile.Instruments);
        Assert.Equal(12, profile.YearsExperience);
        Assert.Equal("https://youtu.be/xyz", profile.VideoUrl);
        Assert.True(profile.IsOpenToJoin);
    }

    [Fact]
    public async Task UpdatesEveryFieldAndReturnsTheProfileWithItsGroups()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var userId = AddUser(users, "Mateo", UserType.Musician);
        AddMusician(users, userId);
        var groupId = await AddGroupAsync(groups, "Los Vargas", "los-vargas", ownerId: userId);
        await AddMemberAsync(groups, groupId, userId, GroupMemberRole.Owner);

        var result = await Handler(users, groups).Handle(
            new UpdateMyMusicianProfileCommand(
                userId,
                Headline: "Productor",
                ShortBio: "Nueva bio.",
                Instruments: "Teclados",
                YearsExperience: 20,
                VideoUrl: "https://youtu.be/nuevo",
                IsOpenToJoin: false),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var profile = result.Value!;
        Assert.Equal("Mateo Prueba", profile.FullName);
        Assert.Equal("Productor", profile.Headline);
        Assert.Equal("Nueva bio.", profile.ShortBio);
        Assert.Equal("Teclados", profile.Instruments);
        Assert.Equal(20, profile.YearsExperience);
        Assert.Equal("https://youtu.be/nuevo", profile.VideoUrl);
        Assert.False(profile.IsOpenToJoin);

        var membership = Assert.Single(profile.Groups);
        Assert.Equal(groupId, membership.GroupId);
        Assert.Equal("Los Vargas", membership.GroupName);
        Assert.Equal(GroupMemberRole.Owner, membership.Role);
    }

    [Fact]
    public async Task Client_IsForbiddenAndNothingIsWritten()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var userId = AddUser(users, "Carla", UserType.Client);

        var result = await Handler(users, groups).Handle(
            new UpdateMyMusicianProfileCommand(userId, Headline: "No debería", null, null, null, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("El usuario no es músico.", result.Error);
        Assert.Empty(users.Musicians);
    }

    [Fact]
    public async Task UnknownUser_IsForbidden()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var result = await Handler(users, groups).Handle(
            new UpdateMyMusicianProfileCommand(4242, Headline: "Fantasma", null, null, null, null, null),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("El usuario no es músico.", result.Error);
    }

    [Fact]
    public async Task City_IsSavedAndReturned_AndALaterUpdateWithoutCityKeepsIt()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var userId = AddUser(users, "Mateo", UserType.Musician);
        AddMusician(users, userId);

        var first = await Handler(users, groups).Handle(
            new UpdateMyMusicianProfileCommand(userId, null, null, null, null, null, null, City: "Rosario"),
            CancellationToken.None);

        Assert.True(first.IsSuccess, first.Error);
        Assert.Equal("Rosario", first.Value!.City);
        Assert.Equal("Rosario", MusicianOf(users, userId).City);

        var second = await Handler(users, groups).Handle(
            new UpdateMyMusicianProfileCommand(userId, Headline: "Productor", null, null, null, null, null),
            CancellationToken.None);

        Assert.True(second.IsSuccess, second.Error);
        Assert.Equal("Rosario", second.Value!.City);
        Assert.Equal("Rosario", MusicianOf(users, userId).City);
    }

    private UpdateMyMusicianProfileCommandHandler Handler(UsersDbContext users, GroupsDbContext groups)
        => new(fixture.CreateUsersUnitOfWork(users), new GroupsModuleApi(groups));

    private static Musician MusicianOf(UsersDbContext context, long userId)
        => context.Musicians.Single(m => m.UserId == userId);

    private static long AddUser(UsersDbContext context, string firstName, UserType userType)
    {
        var user = new User(
            $"auth0|{Guid.NewGuid():N}",
            $"{firstName}.{Guid.NewGuid():N}@example.com".ToLowerInvariant(),
            firstName,
            "Prueba",
            userType);
        context.Users.Add(user);
        context.SaveChanges();
        return user.Id;
    }

    private static void AddMusician(
        UsersDbContext context,
        long userId,
        string? headline = null,
        string? shortBio = null,
        string? instruments = null,
        int years = 0,
        string? videoUrl = null,
        bool isOpenToJoin = true)
    {
        context.Musicians.Add(new Musician
        {
            UserId = userId,
            Headline = headline,
            ShortBio = shortBio,
            Instruments = instruments,
            YearsExperience = years,
            VideoUrl = videoUrl,
            IsOpenToJoin = isOpenToJoin
        });
        context.SaveChanges();
    }

    private static async Task<long> AddGroupAsync(GroupsDbContext context, string name, string slug, long ownerId)
    {
        var group = new Group { OwnerUserId = ownerId, Slug = slug, GroupName = name, Active = true };
        context.Groups.Add(group);
        await context.SaveChangesAsync();
        return group.Id;
    }

    private static async Task AddMemberAsync(
        GroupsDbContext context, long groupId, long userId, GroupMemberRole role)
    {
        context.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = true,
            JoinedAt = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc),
            JoinedVia = JoinedVia.Manual
        });
        await context.SaveChangesAsync();
    }
}
