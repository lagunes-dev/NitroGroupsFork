using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Users.Application.UseCases.Musicians.GetProfile;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.EndpointMapping;
using static Microsoft.AspNetCore.Http.Results;

namespace NitroGroups.Core.Users.Infrastructure.Endpoints.Musicians
{
    /// <summary>
    /// S1, S2: the public musician profile. It is shareable: it opens with no session (it is in the
    /// public allowlist of the security tests). 404 when the user is not a musician.
    /// </summary>
    public class GetProfile : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
        {
            app.MapGet("api/musicians/{userId:long}", async (long userId, IMediator mediator) =>
            {
                var result = await mediator.SendQueryAsync<GetMusicianProfileQuery, Result<MusicianProfileResponse>>(
                    new GetMusicianProfileQuery(userId));

                return result.IsFailure
                    ? Problem(result.Error, statusCode: StatusCodes.Status404NotFound)
                    : Ok(result.Value);
            })
            .AllowAnonymous()
            .WithTags("Musicians");
        }
    }
}
