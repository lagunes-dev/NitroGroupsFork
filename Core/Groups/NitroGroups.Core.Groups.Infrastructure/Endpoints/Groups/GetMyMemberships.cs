using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetMyMemberships;
using NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.EndpointMapping;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.Groups;

public class GetMyMemberships : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app)
    {
        // The caller's active memberships. Identity comes from the token only.
        app.MapGet("api/users/me/memberships", async (IMediator mediator, ICurrentUserService currentUser) =>
            {
                var result = await mediator.SendQueryAsync<GetMyGroupMembershipsQuery, GroupsResult<List<GroupMembershipSummary>>>(
                    new GetMyGroupMembershipsQuery(currentUser.GetUserId()!.Value));
                return result.ToHttp(Results.Ok);
            })
            .RequireSyncedUser()
            .WithTags("Groups");
    }
}
