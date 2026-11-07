using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Tests.Integration.Groups;

public class GroupMembershipRequestTests
{
    private static GroupMembershipRequest NewRequest(
        MembershipDirection direction = MembershipDirection.Invitation, string? message = null) =>
        GroupMembershipRequest.Create(groupId: 10, musicianUserId: 20, initiatedByUserId: 30, direction, message);

    [Fact]
    public void Create_StartsPendingWithoutResolver()
    {
        var request = NewRequest(MembershipDirection.Request, "  Can I join?  ");

        Assert.Equal(MembershipRequestStatus.Pending, request.Status);
        Assert.Equal(10, request.GroupId);
        Assert.Equal(20, request.MusicianUserId);
        Assert.Equal(30, request.InitiatedByUserId);
        Assert.Equal(MembershipDirection.Request, request.Direction);
        Assert.Null(request.ResolvedByUserId);
        Assert.Equal("Can I join?", request.Message);
    }

    [Fact]
    public void Create_BlankMessage_IsStoredAsNull()
    {
        Assert.Null(NewRequest(message: "   ").Message);
    }

    [Theory]
    [InlineData(0, 20, 30)]
    [InlineData(10, -1, 30)]
    [InlineData(10, 20, 0)]
    public void Create_NonPositiveIds_Throw(long groupId, long musicianId, long initiatorId)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            GroupMembershipRequest.Create(groupId, musicianId, initiatorId, MembershipDirection.Invitation, null));
    }

    [Fact]
    public void Create_MessageTooLong_Throws()
    {
        var tooLong = new string('x', GroupMembershipRequest.MaxMessageLength + 1);
        Assert.Throws<ArgumentException>(() => NewRequest(message: tooLong));
        Assert.NotNull(NewRequest(message: new string('x', GroupMembershipRequest.MaxMessageLength)).Message);
    }

    [Fact]
    public void Accept_FromPending_SetsStatusAndResolver()
    {
        var request = NewRequest();
        request.Accept(20);
        Assert.Equal(MembershipRequestStatus.Accepted, request.Status);
        Assert.Equal(20, request.ResolvedByUserId);
    }

    [Fact]
    public void Decline_FromPending_SetsStatusAndResolver()
    {
        var request = NewRequest();
        request.Decline(20);
        Assert.Equal(MembershipRequestStatus.Declined, request.Status);
        Assert.Equal(20, request.ResolvedByUserId);
    }

    [Fact]
    public void Cancel_FromPending_SetsStatusAndResolver()
    {
        var request = NewRequest();
        request.Cancel(30);
        Assert.Equal(MembershipRequestStatus.Cancelled, request.Status);
        Assert.Equal(30, request.ResolvedByUserId);
    }

    [Fact]
    public void Resolve_WithInvalidUserId_ThrowsAndStaysPending()
    {
        var request = NewRequest();
        Assert.Throws<ArgumentOutOfRangeException>(() => request.Accept(0));
        Assert.Equal(MembershipRequestStatus.Pending, request.Status);
        Assert.Null(request.ResolvedByUserId);
    }

    public static IEnumerable<object[]> Resolutions()
    {
        foreach (var from in new[] { "accept", "decline", "cancel" })
        foreach (var then in new[] { "accept", "decline", "cancel" })
            yield return [from, then];
    }

    private static void Apply(GroupMembershipRequest request, string action, long userId)
    {
        switch (action)
        {
            case "accept": request.Accept(userId); break;
            case "decline": request.Decline(userId); break;
            default: request.Cancel(userId); break;
        }
    }

    [Theory]
    [MemberData(nameof(Resolutions))]
    public void AnyTransitionFromNonPending_ThrowsAndKeepsState(string first, string second)
    {
        var request = NewRequest();
        Apply(request, first, 20);
        var status = request.Status;

        Assert.Throws<InvalidGroupMembershipTransitionException>(() => Apply(request, second, 99));

        Assert.Equal(status, request.Status);
        Assert.Equal(20, request.ResolvedByUserId);
    }
}
