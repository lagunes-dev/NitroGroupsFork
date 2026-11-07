using AutoMapper;
using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Update;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Requests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;
using static Microsoft.AspNetCore.Http.Results;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.Groups
{
    public class Update : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
        {
            app.MapPut("api/groups/{id:long}", async (long id, UpdateGroupRequest request, IMediator mediator, IMapper mapper) =>
            {
                var command = mapper.Map<UpdateGroupCommand>(request, opt => opt.Items["Id"] = id);
                var result = await mediator.SendCommandAsync<UpdateGroupCommand, Result<GroupResponse>>(command);
                return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
            })
            .AddEndpointFilter<ValidationFilter<UpdateGroupRequest>>()
            .RequireGroupManager("id")
            .WithTags("Groups");
        }
    }
}
