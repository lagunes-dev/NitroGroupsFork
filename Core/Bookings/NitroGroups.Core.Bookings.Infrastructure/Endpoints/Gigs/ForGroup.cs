using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.Gigs;

/// <summary>S2: el panel del manager. Solo Owner o Manager del grupo (403 si no lo administra).</summary>
public class ForGroup : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/groups/{groupId:long}/gigs", async (long groupId, IMediator mediator, ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendQueryAsync<GetGroupGigsQuery, List<GroupGigResponse>>(
                    new GetGroupGigsQuery(groupId, currentUser.GetUserId()));
                return Results.Ok(result);
            })
            .RequireGroupManager()
            .WithTags(GigEndpoints.Tag);
    }
}
