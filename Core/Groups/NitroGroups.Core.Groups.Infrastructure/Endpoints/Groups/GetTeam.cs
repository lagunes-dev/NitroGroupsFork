using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetTeam;
using NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.Groups;

/// <summary>
/// El equipo del grupo con nombres y roles. Solo Owner o Manager del grupo (403 si no lo
/// administra): la lista pública de <c>/members</c> solo devuelve ids.
/// </summary>
public class GetTeam : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/groups/{groupId:long}/team", async (long groupId, IMediator mediator) =>
            {
                var result = await mediator
                    .SendQueryAsync<GetGroupTeamQuery, GroupsResult<List<GroupTeamMemberResponse>>>(new(groupId));
                return result.ToHttp(Results.Ok);
            })
            .RequireGroupManager()
            .WithTags("Groups");
    }
}
