using System.Net;
using System.Text.Json;
using Cortex.Mediator;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetMyMemberships;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Endpoints.Groups;

/// <summary>
/// S6: <c>GET api/users/me/memberships</c> is private, takes the identity from the token and
/// serializes the role as text.
/// </summary>
public class MyMembershipsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const string Url = "api/users/me/memberships";

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public MyMembershipsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;
    }

    private void Returns(List<GroupMembershipSummary> memberships)
        => _mediator
            .SendQueryAsync<GetMyGroupMembershipsQuery, GroupsResult<List<GroupMembershipSummary>>>(Arg.Any<GetMyGroupMembershipsQuery>())
            .Returns(GroupsResult<List<GroupMembershipSummary>>.Success(memberships));

    [Fact]
    public async Task WithoutToken_Returns401()
    {
        var response = await _anonymous.GetAsync(Url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnsyncedUser_Returns401()
    {
        var response = await _unregistered.GetAsync(Url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task IdentityComesFromToken_NotFromQuery()
    {
        Returns([]);

        await _client.GetAsync($"{Url}?userId=777");

        await _mediator.Received().SendQueryAsync<GetMyGroupMembershipsQuery, GroupsResult<List<GroupMembershipSummary>>>(
            Arg.Is<GetMyGroupMembershipsQuery>(q => q.UserId == TestAuthHandler.UserId));
        await _mediator.DidNotReceive().SendQueryAsync<GetMyGroupMembershipsQuery, GroupsResult<List<GroupMembershipSummary>>>(
            Arg.Is<GetMyGroupMembershipsQuery>(q => q.UserId == 777));
    }

    [Fact]
    public async Task NoMemberships_Returns200WithEmptyArray()
    {
        Returns([]);

        var response = await _client.GetAsync(Url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Memberships_Returns200WithShapeAndRoleAsText()
    {
        Returns(
        [
            new GroupMembershipSummary
            {
                GroupId = 7,
                GroupName = "Los Vargas",
                Slug = "los-vargas",
                ProfilePictureUrl = "https://cdn.example.com/p.jpg",
                Role = GroupMemberRole.Manager,
                JoinedAt = new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc)
            }
        ]);

        var response = await _client.GetAsync(Url);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var item = Assert.Single(json.RootElement.EnumerateArray());
        Assert.Equal(7, item.GetProperty("groupId").GetInt64());
        Assert.Equal("Los Vargas", item.GetProperty("groupName").GetString());
        Assert.Equal("los-vargas", item.GetProperty("slug").GetString());
        Assert.Equal("https://cdn.example.com/p.jpg", item.GetProperty("profilePictureUrl").GetString());
        Assert.Equal("Manager", item.GetProperty("role").GetString());
        Assert.Equal(new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc), item.GetProperty("joinedAt").GetDateTime().ToUniversalTime());
    }
}
