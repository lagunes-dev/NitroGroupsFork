using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Groups.Requests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;

/// <summary>Un Owner/Manager invita a un músico (S1). Quien invita sale del token.</summary>
public class Invite : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        app.MapPost("api/groups/{groupId:long}/membership-invitations", async (
                long groupId,
                InviteMusicianRequest body,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var command = new InviteMusicianCommand(
                    groupId,
                    currentUser.GetUserId()!.Value,
                    body.MusicianUserId,
                    body.Message);

                var result = await mediator.SendCommandAsync<InviteMusicianCommand, GroupsResult<GroupMembershipRequestResponse>>(command);
                return result.ToHttp(value => Results.Created($"api/membership-requests/{value.Id}", value));
            })
            .RequireGroupManager()
            .AddEndpointFilter<ValidationFilter<InviteMusicianRequest>>()
            .WithTags(MembershipRequestEndpointExtensions.Tag);
    }
}
