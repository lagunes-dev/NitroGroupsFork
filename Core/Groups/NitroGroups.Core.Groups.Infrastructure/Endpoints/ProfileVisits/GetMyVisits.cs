using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.GetMine;
using NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.ProfileVisits;

/// <summary>
/// S9: el músico lee qué grupos miraron su perfil (<c>GET api/me/profile-visits</c>). Sale de su
/// propio token: nadie puede leer las visitas de otro. Sin visitas responde cero y lista vacía.
/// </summary>
public class GetMyVisits : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/me/profile-visits", async (IMediator mediator, ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendQueryAsync<GetMyProfileVisitsQuery, GroupsResult<ProfileVisitsResponse>>(
                    new GetMyProfileVisitsQuery(currentUser.GetUserId()!.Value));
                return result.ToHttp(Results.Ok);
            })
            .RequireSyncedUser()
            .WithTags(ProfileVisitEndpointExtensions.Tag);
    }
}
