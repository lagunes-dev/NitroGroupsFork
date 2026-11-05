using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Users.Responses;

namespace NitroGroups.Core.Users.Application.UseCases.Musicians;

/// <summary>
/// Builds the public musician profile. Both the public read and the musician's own update return
/// this same object, so it is built in one place.
/// </summary>
internal static class MusicianProfileProjection
{
    public static MusicianProfileResponse ToResponse(
        User user,
        Musician musician,
        IReadOnlyList<GroupMembershipSummary> memberships)
        => new()
        {
            UserId = user.Id,
            FullName = $"{user.FirstName} {user.LastName}".Trim(),
            Headline = musician.Headline,
            ShortBio = musician.ShortBio,
            Instruments = musician.Instruments,
            YearsExperience = musician.YearsExperience,
            ProfilePictureUrl = user.ProfilePictureUrl,
            VideoUrl = musician.VideoUrl,
            IsOpenToJoin = musician.IsOpenToJoin,
            Groups = memberships
                .Select(membership => new MusicianProfileGroup
                {
                    GroupId = membership.GroupId,
                    GroupName = membership.GroupName,
                    Slug = membership.Slug,
                    Role = membership.Role
                })
                .ToList()
        };
}
