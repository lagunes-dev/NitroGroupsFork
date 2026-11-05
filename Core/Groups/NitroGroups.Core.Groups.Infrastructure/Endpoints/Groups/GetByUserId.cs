using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetByUserId;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;
using static Microsoft.AspNetCore.Http.Results;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.Groups
{
    public class GetByUserId : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
        {
            app.MapGet("api/users/{userId:long}/groups", async (long userId, IMediator mediator) =>
            {
                var result = await mediator.SendQueryAsync<GetGroupByUserIdQuery, Result<GroupResponse?>>(new GetGroupByUserIdQuery(userId));

                if (result.IsFailure)
                    return NotFound();

                // "Este usuario todavía no tiene grupo" es una respuesta, no un error: viaja como 200
                // con cuerpo null y el front lo lee como "sin grupo" (T22). Cualquier otro 404 queda
                // para lo que no existe.
                return result.Value is null
                    ? Text("null", "application/json", statusCode: StatusCodes.Status200OK)
                    : Ok(result.Value);
            })
            .WithTags("Groups");
        }
    }
}
