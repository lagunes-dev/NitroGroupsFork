using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetPublicTeam;
using NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.Groups;

/// <summary>
/// El equipo con caras en el perfil público (S14): nombre, rol e instrumento · ciudad de cada
/// miembro activo, sin correos. Público a propósito (AllowAnonymous, declarado en
/// <c>SecurityEndpointsTests</c>): es lo que lee cualquier visitante del grupo. La versión con
/// fechas de alta y datos del manager sigue siendo <c>/team</c>, que exige Owner/Manager.
/// </summary>
public class GetPublicTeam : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/groups/{groupId:long}/team/public", async (long groupId, IMediator mediator) =>
            {
                var result = await mediator
                    .SendQueryAsync<GetPublicGroupTeamQuery, GroupsResult<List<PublicGroupTeamMemberResponse>>>(new(groupId));
                return result.ToHttp(Results.Ok);
            })
            .AllowAnonymous()
            .WithTags("Groups");
    }
}
