using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.CheckoutNotes;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.EventRequests;

/// <summary>
/// Ronda 9: cómo pagar. Solo el cliente de un pedido aceptado; cualquier otro caso es 404, igual
/// que el detalle del pedido para quien no es parte. La app no cobra ni interviene (D1/S18).
/// </summary>
public class CheckoutNotes : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/event-requests/{id:long}/checkout-notes", async (
                long id,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendQueryAsync<GetEventRequestCheckoutNotesQuery, BookingResult<List<CheckoutNoteResponse>>>(
                    new GetEventRequestCheckoutNotesQuery(id, currentUser.GetUserId()));
                return result.ToHttp(value => Results.Ok(value));
            })
            // El admin no entra: estas notas son del cliente del pedido, no de quien lo audita.
            .RequireSyncedUser()
            .WithTags(BookingEndpointExtensions.Tag);
    }
}
