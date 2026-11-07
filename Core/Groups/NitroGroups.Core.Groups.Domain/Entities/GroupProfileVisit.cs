using NitroGroups.Shared.Domain;

namespace NitroGroups.Core.Groups.Domain.Entities;

/// <summary>
/// One look at a musician's public profile, by one group (S9). There is at most one row per
/// (group, musician): refreshing the profile moves <see cref="LastVisitedAt"/> instead of adding
/// a row, so "3 grupos" counts groups and never clicks. The visitor is whoever manages the group;
/// only the musician's user id is stored, never an email or any of his data.
/// </summary>
public class GroupProfileVisit : AuditableModel
{
    public long GroupId { get; private set; }
    public long MusicianUserId { get; private set; }

    /// <summary>When this group looked at the profile the last time.</summary>
    public DateTime LastVisitedAt { get; private set; }

    public virtual Group Group { get; private set; } = null!;

    private GroupProfileVisit() { }

    public static GroupProfileVisit Create(long groupId, long musicianUserId, DateTime visitedAt)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(groupId);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(musicianUserId);

        return new GroupProfileVisit
        {
            GroupId = groupId,
            MusicianUserId = musicianUserId,
            LastVisitedAt = visitedAt
        };
    }

    /// <summary>The same group looked again: the visit is the same one, only newer.</summary>
    public void MarkVisited(DateTime visitedAt) => LastVisitedAt = visitedAt;
}
