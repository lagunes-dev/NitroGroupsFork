using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Reviews;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.EventRequests;

/// <summary>
/// S5: el cliente califica un evento aceptado cuya fecha ya pasó. El autor es el usuario del
/// token; el handler decide con la solicitud guardada (404 si no es suya).
/// </summary>
public class Review : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("api/event-requests/{id:long}/review", async (
                long id,
                PostEventReviewBody body,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendCommandAsync<PostEventReviewCommand, BookingResult<EventReviewResponse>>(
                    new PostEventReviewCommand(id, currentUser.GetUserId()!.Value, body.Rating, body.Comment));
                return result.ToHttp(value => Results.Created($"api/event-requests/{id}", value));
            })
            .RequireSyncedUser()
            .AddEndpointFilter<ValidationFilter<PostEventReviewBody>>()
            .WithTags(BookingEndpointExtensions.Tag);
    }
}
