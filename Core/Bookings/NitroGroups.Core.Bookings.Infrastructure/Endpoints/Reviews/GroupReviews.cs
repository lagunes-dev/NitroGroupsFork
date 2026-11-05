using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Bookings.Application.UseCases.Reviews;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Bookings.Infrastructure.Endpoints.Reviews;

/// <summary>
/// Reseñas públicas de un grupo (D7): perfil visitable sin sesión, de la más reciente a la
/// más antigua, con el autor como "Nombre A." y nunca su correo.
/// </summary>
public class GroupReviews : IEndpoint
{
    public const string Tag = "Reviews";

    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapGet("api/groups/{groupId:long}/reviews", async (
                long groupId,
                IMediator mediator,
                int page = 1,
                int size = 10) =>
            {
                var result = await mediator.SendQueryAsync<GetGroupReviewsQuery, GroupReviewsResponse>(
                    new GetGroupReviewsQuery(groupId, page, size));
                return Results.Ok(result);
            })
            .AllowAnonymous()
            .WithTags(Tag);
    }
}
