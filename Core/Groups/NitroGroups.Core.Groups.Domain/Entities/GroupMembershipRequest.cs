using NitroGroups.Shared.Domain;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Domain.Entities;

/// <summary>
/// An invitation (manager to musician) or a request to join (musician to group).
/// Kept apart from <see cref="GroupMember"/> so pending people never show up as members.
/// Valid transitions: Pending → Accepted | Declined | Cancelled. Any other one is an error.
/// </summary>
public class GroupMembershipRequest : AuditableModel
{
    public const int MaxMessageLength = 2000;

    public long GroupId { get; private set; }
    public long MusicianUserId { get; private set; }
    public long InitiatedByUserId { get; private set; }
    public MembershipDirection Direction { get; private set; }
    public MembershipRequestStatus Status { get; private set; } = MembershipRequestStatus.Pending;
    public long? ResolvedByUserId { get; private set; }
    public string? Message { get; private set; }

    /// <summary>
    /// Optimistic concurrency token (PostgreSQL system column xmin): if two people answer at the
    /// same time, only the first save wins.
    /// </summary>
    public uint Version { get; private set; }

    public virtual Group Group { get; private set; } = null!;

    private GroupMembershipRequest() { }

    public static GroupMembershipRequest Create(
        long groupId, long musicianUserId, long initiatedByUserId, MembershipDirection direction, string? message)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(groupId);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(musicianUserId);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(initiatedByUserId);

        var trimmed = string.IsNullOrWhiteSpace(message) ? null : message.Trim();
        if (trimmed is { Length: > MaxMessageLength })
            throw new ArgumentException($"The message cannot exceed {MaxMessageLength} characters.", nameof(message));

        return new GroupMembershipRequest
        {
            GroupId = groupId,
            MusicianUserId = musicianUserId,
            InitiatedByUserId = initiatedByUserId,
            Direction = direction,
            Message = trimmed
        };
    }

    /// <summary>The receiving side accepts. Only from Pending.</summary>
    public void Accept(long resolverUserId) => Resolve(MembershipRequestStatus.Accepted, resolverUserId, "accepted");

    /// <summary>The receiving side declines. Only from Pending.</summary>
    public void Decline(long resolverUserId) => Resolve(MembershipRequestStatus.Declined, resolverUserId, "declined");

    /// <summary>The initiator withdraws it. Only from Pending.</summary>
    public void Cancel(long actorUserId) => Resolve(MembershipRequestStatus.Cancelled, actorUserId, "cancelled");

    private void Resolve(MembershipRequestStatus newStatus, long userId, string verb)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(userId);

        if (Status != MembershipRequestStatus.Pending)
            throw new InvalidGroupMembershipTransitionException(
                $"Only a pending request can be {verb}; this one is {Status.ToString().ToLowerInvariant()}.");

        Status = newStatus;
        ResolvedByUserId = userId;
    }
}
