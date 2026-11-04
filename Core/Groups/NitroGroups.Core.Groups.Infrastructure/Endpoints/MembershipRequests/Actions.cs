using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Respond;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;

/// <summary>
/// Aceptar, rechazar y cancelar. El permiso lo decide el handler con la solicitud guardada
/// (no con la ruta): los ajenos reciben 404 y quien participa sin el papel correcto, 403.
/// </summary>
public class Actions : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        MapRespond(app, "accept", MembershipRequestDecision.Accept);
        MapRespond(app, "decline", MembershipRequestDecision.Decline);
        MapRespond(app, "cancel", MembershipRequestDecision.Cancel);
    }

    private static void MapRespond(IEndpointRouteBuilder app, string action, MembershipRequestDecision decision)
    {
        app.MapPost($"api/membership-requests/{{id:long}}/{action}", async (
                long id,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var command = new RespondToMembershipRequestCommand(id, currentUser.GetUserId()!.Value, decision);
                var result = await mediator.SendCommandAsync<RespondToMembershipRequestCommand, GroupsResult<GroupMembershipRequestResponse>>(command);
                return result.ToHttp(value => Results.Ok(value));
            })
            .RequireSyncedUser()
            .WithTags(MembershipRequestEndpointExtensions.Tag);
    }
}
