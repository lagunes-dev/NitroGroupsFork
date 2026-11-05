using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cortex.Mediator;
using NitroGroups.Core.Users.Application.UseCases.Musicians.GetProfile;
using NitroGroups.Core.Users.Application.UseCases.Musicians.UpdateMyProfile;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Requests;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Endpoints.Users;

/// <summary>
/// S1, S2, S4: the public musician profile (<c>GET api/musicians/{userId:long}</c>, no session
/// needed) and the caller's own edit (<c>PUT api/musicians/me</c>, identity from the token only).
/// </summary>
public class MusicianProfileEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const string GetUrl = "api/musicians/5";
    private const string PutUrl = "api/musicians/me";

    /// <summary>Exact contract the frontend reads. Adding or renaming a field is a breaking change.</summary>
    private static readonly string[] ProfileProperties =
    [
        "userId",
        "fullName",
        "headline",
        "shortBio",
        "instruments",
        "yearsExperience",
        "profilePictureUrl",
        "videoUrl",
        "isOpenToJoin",
        "groups"
    ];

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly IMediator _mediator;

    public MusicianProfileEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _mediator = factory.Mediator;

        // The factory (and its mediator substitute) is shared by the whole class, so the call
        // history of a previous test must not leak into this one's DidNotReceive assertions.
        _mediator.ClearReceivedCalls();
    }

    private static MusicianProfileResponse Profile() => new()
    {
        UserId = 5,
        FullName = "Mateo Ríos",
        Headline = "Guitarrista de sesión",
        ShortBio = "Toco desde los 12.",
        Instruments = "Guitarra, bajo",
        YearsExperience = 12,
        ProfilePictureUrl = "https://cdn.example.com/mateo.jpg",
        VideoUrl = "https://youtu.be/xyz",
        IsOpenToJoin = true,
        Groups =
        [
            new MusicianProfileGroup
            {
                GroupId = 7,
                GroupName = "Los Vargas",
                Slug = "los-vargas",
                Role = GroupMemberRole.Manager
            }
        ]
    };

    private void GetReturns(Result<MusicianProfileResponse> result)
        => _mediator
            .SendQueryAsync<GetMusicianProfileQuery, Result<MusicianProfileResponse>>(Arg.Any<GetMusicianProfileQuery>())
            .Returns(result);

    private void PutReturns(Result<MusicianProfileResponse> result)
        => _mediator
            .SendCommandAsync<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>(
                Arg.Any<UpdateMyMusicianProfileCommand>())
            .Returns(result);

    // ---------------------------------------------------------------
    // GET api/musicians/{userId:long} — public
    // ---------------------------------------------------------------

    [Fact]
    public async Task Get_WithoutToken_Returns200WithTheProfileAndItsGroups()
    {
        GetReturns(Result<MusicianProfileResponse>.Success(Profile()));

        var response = await _anonymous.GetAsync(GetUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;

        // The whole object is the contract: no missing and no extra fields.
        Assert.Equal(ProfileProperties.Order(), root.EnumerateObject().Select(p => p.Name).Order());

        Assert.Equal(5, root.GetProperty("userId").GetInt64());
        Assert.Equal("Mateo Ríos", root.GetProperty("fullName").GetString());
        Assert.Equal("Guitarrista de sesión", root.GetProperty("headline").GetString());
        Assert.Equal("Toco desde los 12.", root.GetProperty("shortBio").GetString());
        Assert.Equal("Guitarra, bajo", root.GetProperty("instruments").GetString());
        Assert.Equal(12, root.GetProperty("yearsExperience").GetInt32());
        Assert.Equal("https://cdn.example.com/mateo.jpg", root.GetProperty("profilePictureUrl").GetString());
        Assert.Equal("https://youtu.be/xyz", root.GetProperty("videoUrl").GetString());
        Assert.True(root.GetProperty("isOpenToJoin").GetBoolean());

        var group = Assert.Single(root.GetProperty("groups").EnumerateArray());
        Assert.Equal(7, group.GetProperty("groupId").GetInt64());
        Assert.Equal("Los Vargas", group.GetProperty("groupName").GetString());
        Assert.Equal("los-vargas", group.GetProperty("slug").GetString());
        Assert.Equal("Manager", group.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Get_NonMusician_Returns404()
    {
        GetReturns(Result<MusicianProfileResponse>.Failure("El músico no existe."));

        var response = await _anonymous.GetAsync(GetUrl);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Get_TakesTheUserIdFromTheRoute()
    {
        GetReturns(Result<MusicianProfileResponse>.Success(Profile()));

        await _anonymous.GetAsync(GetUrl);

        await _mediator.Received().SendQueryAsync<GetMusicianProfileQuery, Result<MusicianProfileResponse>>(
            Arg.Is<GetMusicianProfileQuery>(q => q.UserId == 5));
    }

    // ---------------------------------------------------------------
    // PUT api/musicians/me — authenticated, musicians only
    // ---------------------------------------------------------------

    [Fact]
    public async Task Put_WithoutToken_Returns401()
    {
        var response = await _anonymous.PutAsJsonAsync(PutUrl, new UpdateMusicianProfileRequest { Headline = "Nuevo" }, ApiJsonOptions.Default);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await _mediator.DidNotReceive().SendCommandAsync<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>(
            Arg.Any<UpdateMyMusicianProfileCommand>());
    }

    [Fact]
    public async Task Put_NonMusician_Returns403()
    {
        PutReturns(Result<MusicianProfileResponse>.Failure("El usuario no es músico."));

        var response = await _client.PutAsJsonAsync(PutUrl, new UpdateMusicianProfileRequest { Headline = "Nuevo" }, ApiJsonOptions.Default);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Put_IdentityComesFromToken_NotFromBody()
    {
        PutReturns(Result<MusicianProfileResponse>.Success(Profile()));

        // A body carrying someone else's id must not change who is edited.
        await _client.PutAsJsonAsync(PutUrl, new { userId = 999, headline = "Suplantado" }, ApiJsonOptions.Default);

        await _mediator.Received().SendCommandAsync<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>(
            Arg.Is<UpdateMyMusicianProfileCommand>(c => c.UserId == TestAuthHandler.UserId));
        await _mediator.DidNotReceive().SendCommandAsync<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>(
            Arg.Is<UpdateMyMusicianProfileCommand>(c => c.UserId == 999));
    }

    [Fact]
    public async Task Put_Returns200WithTheSameObjectAsGet()
    {
        PutReturns(Result<MusicianProfileResponse>.Success(Profile()));

        var response = await _client.PutAsJsonAsync(PutUrl, new UpdateMusicianProfileRequest
        {
            Headline = "Guitarrista de sesión",
            ShortBio = "Toco desde los 12.",
            Instruments = "Guitarra, bajo",
            YearsExperience = 12,
            VideoUrl = "https://youtu.be/xyz",
            IsOpenToJoin = true
        }, ApiJsonOptions.Default);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(ProfileProperties.Order(), json.RootElement.EnumerateObject().Select(p => p.Name).Order());
        Assert.Equal("Mateo Ríos", json.RootElement.GetProperty("fullName").GetString());
        Assert.Equal("Manager", Assert.Single(json.RootElement.GetProperty("groups").EnumerateArray()).GetProperty("role").GetString());
    }

    [Theory]
    [InlineData(121)]
    [InlineData(500)]
    public async Task Put_OverLongHeadline_Returns400(int length)
    {
        var response = await _client.PutAsJsonAsync(PutUrl, new UpdateMusicianProfileRequest { Headline = new string('a', length) }, ApiJsonOptions.Default);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await _mediator.DidNotReceive().SendCommandAsync<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>(
            Arg.Any<UpdateMyMusicianProfileCommand>());
    }

    [Theory]
    [InlineData(121)]
    [InlineData(500)]
    public async Task Put_OverLongInstruments_Returns400(int length)
    {
        var response = await _client.PutAsJsonAsync(PutUrl, new UpdateMusicianProfileRequest { Instruments = new string('a', length) }, ApiJsonOptions.Default);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await _mediator.DidNotReceive().SendCommandAsync<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>(
            Arg.Any<UpdateMyMusicianProfileCommand>());
    }

    [Fact]
    public async Task Put_OverLongVideoUrl_Returns400()
    {
        var response = await _client.PutAsJsonAsync(PutUrl, new UpdateMusicianProfileRequest { VideoUrl = "https://" + new string('a', 300) }, ApiJsonOptions.Default);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Put_NegativeYearsExperience_Returns400()
    {
        var response = await _client.PutAsJsonAsync(PutUrl, new UpdateMusicianProfileRequest { YearsExperience = -1 }, ApiJsonOptions.Default);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
