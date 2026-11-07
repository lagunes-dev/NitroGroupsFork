namespace NitroGroups.Core.Groups.Domain.Entities;

/// <summary>A status change that the membership request does not allow (e.g. accepting a cancelled one).</summary>
public sealed class InvalidGroupMembershipTransitionException(string message) : InvalidOperationException(message);
