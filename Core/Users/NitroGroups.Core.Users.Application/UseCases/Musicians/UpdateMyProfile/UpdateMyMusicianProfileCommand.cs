using Cortex.Mediator.Commands;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;

namespace NitroGroups.Core.Users.Application.UseCases.Musicians.UpdateMyProfile;

/// <summary>
/// S3, S4: a musician edits their own profile. <see cref="UserId"/> comes from the token at the
/// HTTP layer, never from the body, so a request can only ever change the caller's profile.
/// Null fields are left untouched.
/// </summary>
public sealed record UpdateMyMusicianProfileCommand(
    long UserId,
    string? Headline,
    string? ShortBio,
    string? Instruments,
    int? YearsExperience,
    string? VideoUrl,
    bool? IsOpenToJoin,
    string? City = null) : ICommand<Result<MusicianProfileResponse>>;

public sealed class UpdateMyMusicianProfileCommandHandler(
    IUnitOfWorkUser unitOfWork,
    IGroupsModuleApi groupsModule)
    : ICommandHandler<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>
{
    /// <summary>The endpoint turns this failure into 403: a client has no musician profile to edit.</summary>
    internal const string NotAMusician = "El usuario no es músico.";

    public async Task<Result<MusicianProfileResponse>> Handle(
        UpdateMyMusicianProfileCommand command, CancellationToken cancellationToken)
    {
        var user = (await unitOfWork.Users.FindAsync(candidate => candidate.Id == command.UserId && candidate.Active))
            .FirstOrDefault();

        if (user is null || user.UserType != UserType.Musician)
            return Result<MusicianProfileResponse>.Failure(NotAMusician);

        var musician = (await unitOfWork.Musicians.FindAsync(candidate => candidate.UserId == command.UserId))
            .FirstOrDefault();

        if (musician is null)
            return Result<MusicianProfileResponse>.Failure(NotAMusician);

        musician.UpdateProfile(
            command.Headline,
            command.ShortBio,
            command.Instruments,
            command.YearsExperience,
            command.VideoUrl,
            command.IsOpenToJoin,
            command.City);

        unitOfWork.Musicians.Update(musician);
        await unitOfWork.CompleteAsync();

        var memberships = await groupsModule.GetUserGroupMembershipsAsync(command.UserId, cancellationToken);

        return Result<MusicianProfileResponse>.Success(MusicianProfileProjection.ToResponse(user, musician, memberships));
    }
}
