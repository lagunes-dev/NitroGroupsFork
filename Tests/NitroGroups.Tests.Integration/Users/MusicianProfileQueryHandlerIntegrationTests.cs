using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Core.Users.Application.UseCases.Musicians.GetProfile;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Users;

/// <summary>
/// S1, S2: the public musician profile query. It reads the profile from the Users module and the
/// groups from the Groups module API, never from another module's tables.
/// </summary>
public class MusicianProfileQueryHandlerIntegrationTests(IntegrationTestFixture fixture)
    : IClassFixture<IntegrationTestFixture>
{
    private static readonly DateTime Now = new(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task MusicianWithTwoGroups_ReturnsProfileAndGroupsOrderedByRole()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var userId = AddUser(users, "Mateo", "Ríos", UserType.Musician, "https://cdn.example.com/mateo.jpg");
        AddMusician(users, userId, headline: "Guitarrista de sesión", instruments: "Guitarra, bajo",
            years: 12, videoUrl: "https://youtu.be/xyz", shortBio: "Toco desde los 12.", isOpenToJoin: true,
            city: "Córdoba");

        var memberGroupId = await AddGroupAsync(groups, "Los Vargas", "los-vargas", ownerId: 1);
        var managedGroupId = await AddGroupAsync(groups, "La Sonora", "la-sonora", ownerId: userId);
        await AddMemberAsync(groups, memberGroupId, userId, GroupMemberRole.Member);
        await AddMemberAsync(groups, managedGroupId, userId, GroupMemberRole.Owner);
        // A group the musician already left must not show up on the public profile.
        var formerGroupId = await AddGroupAsync(groups, "Ex Grupo", "ex-grupo", ownerId: 1);
        await AddMemberAsync(groups, formerGroupId, userId, GroupMemberRole.Manager, active: false);

        var result = await Handler(users, groups).Handle(new GetMusicianProfileQuery(userId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var profile = result.Value!;
        Assert.Equal(userId, profile.UserId);
        Assert.Equal("Mateo Ríos", profile.FullName);
        Assert.Equal("Guitarrista de sesión", profile.Headline);
        Assert.Equal("Toco desde los 12.", profile.ShortBio);
        Assert.Equal("Guitarra, bajo", profile.Instruments);
        Assert.Equal("Córdoba", profile.City);
        Assert.Equal(12, profile.YearsExperience);
        Assert.Equal("https://cdn.example.com/mateo.jpg", profile.ProfilePictureUrl);
        Assert.Equal("https://youtu.be/xyz", profile.VideoUrl);
        Assert.True(profile.IsOpenToJoin);

        Assert.Equal([managedGroupId, memberGroupId], profile.Groups.Select(g => g.GroupId));
        Assert.Equal(["La Sonora", "Los Vargas"], profile.Groups.Select(g => g.GroupName));
        Assert.Equal(["la-sonora", "los-vargas"], profile.Groups.Select(g => g.Slug));
        Assert.Equal([GroupMemberRole.Owner, GroupMemberRole.Member], profile.Groups.Select(g => g.Role));
    }

    [Fact]
    public async Task MusicianWithoutGroups_ReturnsProfileWithEmptyGroups()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var userId = AddUser(users, "Nadia", "Sola", UserType.Musician);
        AddMusician(users, userId);

        var result = await Handler(users, groups).Handle(new GetMusicianProfileQuery(userId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Empty(result.Value!.Groups);
        Assert.Null(result.Value.Headline);
        Assert.Null(result.Value.Instruments);
        Assert.Null(result.Value.VideoUrl);
    }

    [Fact]
    public async Task Client_IsNotAMusician_ReturnsFailure()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var userId = AddUser(users, "Carla", "Cliente", UserType.Client);

        var result = await Handler(users, groups).Handle(new GetMusicianProfileQuery(userId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("El músico no existe.", result.Error);
    }

    [Fact]
    public async Task ClientWithMusicianProfile_IsNotAMusician()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        // The account type decides who is a musician, not the existence of a profile row.
        var userId = AddUser(users, "Dario", "Cliente", UserType.Client);
        AddMusician(users, userId);

        var result = await Handler(users, groups).Handle(new GetMusicianProfileQuery(userId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("El músico no existe.", result.Error);
    }

    [Fact]
    public async Task UnknownUser_ReturnsFailure()
    {
        await using var users = fixture.CreateUsersContext();
        await using var groups = fixture.CreateGroupsContext();

        var result = await Handler(users, groups).Handle(new GetMusicianProfileQuery(4242), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("El músico no existe.", result.Error);
    }

    private GetMusicianProfileQueryHandler Handler(UsersDbContext users, GroupsDbContext groups)
        => new(fixture.CreateUsersUnitOfWork(users), new GroupsModuleApi(groups));

    private static long AddUser(
        UsersDbContext context,
        string firstName,
        string lastName,
        UserType userType,
        string? profilePictureUrl = null)
    {
        var user = new User(
            $"auth0|{Guid.NewGuid():N}",
            $"{firstName}.{Guid.NewGuid():N}@example.com".ToLowerInvariant(),
            firstName,
            lastName,
            userType);

        if (profilePictureUrl is not null)
            user.UpdateProfilePicture(profilePictureUrl);

        context.Users.Add(user);
        context.SaveChanges();
        return user.Id;
    }

    private static void AddMusician(
        UsersDbContext context,
        long userId,
        string? headline = null,
        string? instruments = null,
        int years = 0,
        string? videoUrl = null,
        string? shortBio = null,
        bool isOpenToJoin = true,
        string? city = null)
    {
        context.Musicians.Add(new Musician
        {
            UserId = userId,
            Headline = headline,
            Instruments = instruments,
            YearsExperience = years,
            VideoUrl = videoUrl,
            ShortBio = shortBio,
            IsOpenToJoin = isOpenToJoin,
            City = city
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
        GroupsDbContext context, long groupId, long userId, GroupMemberRole role, bool active = true)
    {
        context.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = active,
            JoinedAt = Now,
            JoinedVia = JoinedVia.Manual
        });
        await context.SaveChangesAsync();
    }
}
