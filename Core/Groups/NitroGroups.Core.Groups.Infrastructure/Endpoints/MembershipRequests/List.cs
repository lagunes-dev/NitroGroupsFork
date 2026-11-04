using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.List;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.EndpointMapping.Filters;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;

public class List : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        // Bandeja del grupo: solo Owner/Manager de ese mismo grupo.
        app.MapGet("api/groups/{groupId:long}/membership-requests", async (
                long groupId,
                MembershipDirection? direction,
                MembershipRequestStatus? status,
                IMediator mediator) =>
            {
                var result = await mediator.SendQueryAsync<GetGroupMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
                    new GetGroupMembershipRequestsQuery(groupId, direction, status));
                return result.ToHttp(Results.Ok);
            })
            .RequireGroupManager()
            .WithTags(MembershipRequestEndpointExtensions.Tag);

        // Bandeja del músico: sus invitaciones y las solicitudes que él envió.
        app.MapGet("api/membership-requests/mine", async (
                MembershipDirection? direction,
                MembershipRequestStatus? status,
                IMediator mediator,
                ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendQueryAsync<GetMyMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>(
                    new GetMyMembershipRequestsQuery(currentUser.GetUserId()!.Value, direction, status));
                return result.ToHttp(Results.Ok);
            })
            .RequireSyncedUser()
            .WithTags(MembershipRequestEndpointExtensions.Tag);
    }
}
