using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Infrastructure.Endpoints.EventRequests;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.Gigs;

/// <summary>
/// S3: el miembro confirma o rechaza el toque. La persona sale del token; el handler responde
/// 404 si no es miembro activo del grupo (sin revelar si el toque existe) y 400 si el estado
/// no es "Confirmed" ni "Declined".
/// </summary>
public class Attendance : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("api/gigs/{id:long}/attendance", async (
                long id,
                [FromBody] SetGigAttendanceBody? body,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(
                    new SetGigAttendanceCommand(id, currentUser.GetUserId()!.Value, body?.Status));
                return result.ToHttp(value => Results.Ok(value));
            })
            .RequireSyncedUser()
            .WithTags(GigEndpoints.Tag);
    }
}
