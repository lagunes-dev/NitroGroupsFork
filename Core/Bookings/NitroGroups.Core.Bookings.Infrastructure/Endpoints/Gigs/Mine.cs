using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Core.Bookings.Infrastructure.Endpoints.EventRequests;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.Gigs;

/// <summary>S1: la agenda del usuario del token, con su rol y su respuesta en cada toque.</summary>
public class Mine : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/me/gigs", async (IMediator mediator, ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendQueryAsync<GetMyGigsQuery, List<GigResponse>>(
                    new GetMyGigsQuery(currentUser.GetUserId()!.Value));
                return Results.Ok(result);
            })
            .RequireSyncedUser()
            .WithTags(GigEndpoints.Tag);
    }
}
