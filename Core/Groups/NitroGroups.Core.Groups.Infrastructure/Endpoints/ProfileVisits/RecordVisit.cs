using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.Record;
using NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.ProfileVisits;

/// <summary>
/// S9: el manager deja una visita al abrir el perfil de un músico. Solo Owner/Manager del grupo de
/// la ruta; el visitante sale del token y no hay cuerpo que el llamante pueda inventar, así que
/// nadie puede registrar visitas a nombre de otro grupo ni de otro manager.
/// </summary>
public class RecordVisit : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("api/groups/{groupId:long}/profile-visits/{musicianUserId:long}", async (
                long groupId,
                long musicianUserId,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var command = new RecordProfileVisitCommand(groupId, musicianUserId, currentUser.GetUserId()!.Value);
                var result = await mediator.SendCommandAsync<RecordProfileVisitCommand, GroupsResult<bool>>(command);
                return result.ToHttp(_ => Results.NoContent());
            })
            .RequireGroupManager()
            .WithTags(ProfileVisitEndpointExtensions.Tag);
    }
}
