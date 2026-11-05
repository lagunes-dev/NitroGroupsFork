using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Notices;
using NitroGroups.Core.Bookings.Infrastructure.Endpoints.EventRequests;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.Gigs;

/// <summary>
/// S12: el aviso preestablecido del músico al manager (falta la llegada, el pago o el setlist) y sus
/// dos lecturas. Lo manda cualquier miembro activo del grupo; el manager lee los del grupo —solo
/// Owner/Manager— y el músico lee solo los suyos de hoy. El cuerpo lleva el tipo y nada más.
/// </summary>
public class Notices : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("api/groups/{groupId:long}/gigs/{id:long}/notices", async (
                long groupId,
                long id,
                [FromBody] PostGigNoticeBody? body,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(
                    new PostGigNoticeCommand(groupId, id, currentUser.GetUserId(), body ?? new PostGigNoticeBody()));
                return result.ToHttp(value => Results.Created($"api/groups/{groupId}/gigs/{id}/notices", value));
            })
            .RequireSyncedUser()
            .WithTags(GigEndpoints.Tag);

        app.MapGet("api/groups/{groupId:long}/gig-notices", async (long groupId, IMediator mediator) =>
            {
                var result = await mediator.SendQueryAsync<GetGroupGigNoticesQuery, List<GigNoticeResponse>>(
                    new GetGroupGigNoticesQuery(groupId));
                return Results.Ok(result);
            })
            .RequireGroupManager()
            .WithTags(GigEndpoints.Tag);

        app.MapGet("api/me/gig-notices/today", async (IMediator mediator, ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendQueryAsync<GetMyGigNoticesTodayQuery, List<GigNoticeResponse>>(
                    new GetMyGigNoticesTodayQuery(currentUser.GetUserId()!.Value));
                return Results.Ok(result);
            })
            .RequireSyncedUser()
            .WithTags(GigEndpoints.Tag);
    }
}
