using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetBySlug;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;
using static Microsoft.AspNetCore.Http.Results;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.Groups
{
    public class GetBySlug : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
        {
            app.MapGet("api/groups/slug/{slug}", async (string slug, IMediator mediator) =>
            {
                var result = await mediator.SendQueryAsync<GetGroupBySlugQuery, Result<PublicGroupResponse>>(new(slug));

                return result.IsSuccess
                    ? Ok(result.Value)
                    : NotFound(result.Error);
            })
            .AllowAnonymous()
            .WithTags("Groups");
        }
    }
}
