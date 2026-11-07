using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Users.Application.UseCases.Musicians.UpdateMyProfile;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Requests;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;
using static Microsoft.AspNetCore.Http.Results;

namespace NitroGroups.Core.Users.Infrastructure.Endpoints.Musicians
{
    /// <summary>
    /// S3, S4: the musician edits their own profile. The account always comes from the token: the
    /// body cannot name another user. 401 without a session, 403 when the caller is not a musician.
    /// Returns the same object as the public profile.
    /// </summary>
    public class UpdateMyProfile : IEndpoint
    {
        private const string NotSyncedMessage = "Usuario no registrado. Llama a POST /api/auth/sync primero.";

        public void MapEndpoint(IEndpointRouteBuilder app)
        {
            app.MapPut("api/musicians/me", async (
                    UpdateMusicianProfileRequest request,
                    IMediator mediator,
                    ICurrentUserService currentUser) =>
                {
                    var userId = currentUser.GetUserId();
                    if (userId is null)
                        return Problem(NotSyncedMessage, statusCode: StatusCodes.Status401Unauthorized);

                    var command = new UpdateMyMusicianProfileCommand(
                        userId.Value,
                        request.Headline,
                        request.ShortBio,
                        request.Instruments,
                        request.YearsExperience,
                        request.VideoUrl,
                        request.IsOpenToJoin);

                    var result = await mediator.SendCommandAsync<UpdateMyMusicianProfileCommand, Result<MusicianProfileResponse>>(command);

                    return result.IsFailure
                        ? Problem(result.Error, statusCode: StatusCodes.Status403Forbidden)
                        : Ok(result.Value);
                })
            .AddEndpointFilter<ValidationFilter<UpdateMusicianProfileRequest>>()
            .WithTags("Musicians");
        }
    }
}
