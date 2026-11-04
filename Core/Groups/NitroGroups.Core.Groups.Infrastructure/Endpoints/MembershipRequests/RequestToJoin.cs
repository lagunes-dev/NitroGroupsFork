using Cortex.Mediator;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.RequestToJoin;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Groups.Requests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;

/// <summary>Un músico pide unirse a un grupo (S1). Quien pide sale del token; el body es opcional.</summary>
public class RequestToJoin : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("api/groups/{groupId:long}/membership-requests", async (
                long groupId,
                RequestToJoinGroupRequest? body,
                IMediator mediator,
                ICurrentUserService currentUser,
                IValidator<RequestToJoinGroupRequest> validator) =>
            {
                // El body es opcional, así que se valida aquí en vez de con ValidationFilter.
                body ??= new RequestToJoinGroupRequest();
                var validation = await validator.ValidateAsync(body);
                if (!validation.IsValid)
                    return Results.ValidationProblem(validation.ToDictionary());

                var command = new RequestToJoinGroupCommand(
                    groupId,
                    currentUser.GetUserId()!.Value,
                    body.Message);

                var result = await mediator.SendCommandAsync<RequestToJoinGroupCommand, GroupsResult<GroupMembershipRequestResponse>>(command);
                return result.ToHttp(value => Results.Created($"api/membership-requests/{value.Id}", value));
            })
            .RequireSyncedUser()
            .WithTags(MembershipRequestEndpointExtensions.Tag);
    }
}
