using Cortex.Mediator.Queries;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;

namespace NitroGroups.Core.Users.Application.UseCases.Musicians.GetProfile;

/// <summary>
/// S1, S2: the public profile of a musician. Anyone can open it (no session), so it only exposes
/// what the profile page shows; the email of the account is never part of it.
/// </summary>
public sealed record GetMusicianProfileQuery(long UserId) : IQuery<Result<MusicianProfileResponse>>;

public sealed class GetMusicianProfileQueryHandler(IUnitOfWorkUser unitOfWork, IGroupsModuleApi groupsModule)
    : IQueryHandler<GetMusicianProfileQuery, Result<MusicianProfileResponse>>
{
    /// <summary>Shared by both profile use cases so the endpoint can answer 404 without guessing.</summary>
    internal const string NotAMusician = "El músico no existe.";

    public async Task<Result<MusicianProfileResponse>> Handle(
        GetMusicianProfileQuery query, CancellationToken cancellationToken)
    {
        // A musician is an active account of type Musician with a musician profile row. Anything
        // else (a client, an unknown id, a deactivated account) has no public profile.
        var user = (await unitOfWork.Users.FindAsync(candidate => candidate.Id == query.UserId && candidate.Active))
            .FirstOrDefault();

        if (user is null || user.UserType != UserType.Musician)
            return Result<MusicianProfileResponse>.Failure(NotAMusician);

        var musician = (await unitOfWork.Musicians.FindAsync(candidate => candidate.UserId == query.UserId))
            .FirstOrDefault();

        if (musician is null)
            return Result<MusicianProfileResponse>.Failure(NotAMusician);

        var memberships = await groupsModule.GetUserGroupMembershipsAsync(query.UserId, cancellationToken);

        return Result<MusicianProfileResponse>.Success(MusicianProfileProjection.ToResponse(user, musician, memberships));
    }
}
