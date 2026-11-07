using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Details;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Pay;
using NitroGroups.Core.Bookings.Infrastructure.Endpoints.EventRequests;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.Gigs;

/// <summary>
/// Logística del toque, solo para Owner/Manager del grupo de la ruta (403 si no lo administra).
/// El handler responde 404 si el toque es de otro grupo o no está aceptado, y 400 si los datos no valen.
/// Ambos devuelven la fila actualizada del panel del manager.
/// </summary>
public class Logistics : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPut("api/groups/{groupId:long}/gigs/{id:long}/details", async (
                long groupId,
                long id,
                [FromBody] UpdateGigDetailsBody? body,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(
                    new UpdateGigDetailsCommand(groupId, id, currentUser.GetUserId(), body ?? new UpdateGigDetailsBody()));
                return result.ToHttp(value => Results.Ok(value));
            })
            .RequireGroupManager()
            .WithTags(GigEndpoints.Tag);

        app.MapPut("api/groups/{groupId:long}/gigs/{id:long}/pay", async (
                long groupId,
                long id,
                [FromBody] SetGigPayBody? body,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(
                    new SetGigPayCommand(groupId, id, currentUser.GetUserId(), body ?? new SetGigPayBody()));
                return result.ToHttp(value => Results.Ok(value));
            })
            .RequireGroupManager()
            .WithTags(GigEndpoints.Tag);
    }
}
