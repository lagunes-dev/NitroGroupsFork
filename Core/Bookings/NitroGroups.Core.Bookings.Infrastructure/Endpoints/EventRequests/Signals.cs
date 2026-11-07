using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Signals;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.EventRequests;

/// <summary>
/// D6: las señales del hilo del manager (choque de fecha y presupuesto contra la tarifa base).
/// Solo Owner/Manager del grupo de la ruta; el handler responde 404 si la solicitud no es de ese grupo.
/// </summary>
public class Signals : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/groups/{groupId:long}/event-requests/{id:long}/signals", async (
                long groupId,
                long id,
                IMediator mediator) =>
            {
                var result = await mediator.SendQueryAsync<GetEventRequestSignalsQuery, BookingResult<EventRequestSignalsResponse>>(
                    new GetEventRequestSignalsQuery(groupId, id));
                return result.ToHttp(value => Results.Ok(value));
            })
            .RequireGroupManager()
            .WithTags(BookingEndpointExtensions.Tag);
    }
}
