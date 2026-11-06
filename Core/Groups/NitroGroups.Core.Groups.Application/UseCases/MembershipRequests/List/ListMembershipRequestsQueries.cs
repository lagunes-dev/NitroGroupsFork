using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.List;

/// <summary>
/// Bandeja del grupo. El endpoint exige <c>RequireGroupManager</c> sobre ese mismo groupId y aquí
/// solo se devuelven solicitudes de ese grupo.
/// </summary>
public sealed record GetGroupMembershipRequestsQuery(
    long GroupId,
    MembershipDirection? Direction,
    MembershipRequestStatus? Status)
    : IQuery<GroupsResult<List<GroupMembershipRequestResponse>>>;

/// <summary>Bandeja del músico: invitaciones recibidas y solicitudes que él hizo.</summary>
public sealed record GetMyMembershipRequestsQuery(
    long MusicianUserId,
    MembershipDirection? Direction,
    MembershipRequestStatus? Status)
    : IQuery<GroupsResult<List<GroupMembershipRequestResponse>>>;

public sealed class GetGroupMembershipRequestsQueryHandler(IUnitOfWorkGroups unitOfWork, IUsersModuleApi users)
    : IQueryHandler<GetGroupMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>
{
    public async Task<GroupsResult<List<GroupMembershipRequestResponse>>> Handle(
        GetGroupMembershipRequestsQuery query,
        CancellationToken cancellationToken)
    {
        var requests = await unitOfWork.MembershipRequests.ListByGroupAsync(
            query.GroupId,
            query.Direction,
            query.Status,
            cancellationToken);

        var group = await unitOfWork.Groups.GetByIdAsync(query.GroupId);

        // T53: una pendiente de alguien que ya está dentro no se puede responder ni es asunto del manager.
        requests = await WithoutPendingFromMembersAsync(requests, query.GroupId, group?.OwnerUserId, cancellationToken);

        var groups = group is null
            ? new Dictionary<long, Group>()
            : new Dictionary<long, Group> { [group.Id] = group };

        var responses = await MembershipRequestResponses.BuildAsync(
            requests,
            groups,
            users,
            viewerIsGroupSide: true,
            cancellationToken);

        return GroupsResult<List<GroupMembershipRequestResponse>>.Success(responses);
    }

    /// <summary>
    /// Fuera las solicitudes *pendientes* de un músico que ya es miembro activo del grupo (o que es su
    /// dueño): aceptarlas no cambia nada y la pestaña "Equipo" ya las muestra como equipo, así que la
    /// bandeja, el aviso "1 músico quiere unirse" y el contador de la pestaña cuentan lo mismo que el
    /// equipo real. Las filas resueltas son historial y no se tocan. Ese estado no lo produce la app
    /// (`InviteMusicianCommand` y `RequestToJoinGroupCommand` lo rechazan con 409): puede venir de datos
    /// viejos, como una solicitud anterior a entrar por otra vía.
    /// </summary>
    private async Task<List<GroupMembershipRequest>> WithoutPendingFromMembersAsync(
        List<GroupMembershipRequest> requests,
        long groupId,
        long? ownerUserId,
        CancellationToken cancellationToken)
    {
        if (!requests.Exists(r => r.Status == MembershipRequestStatus.Pending))
            return requests;

        var members = await unitOfWork.GroupMembers.FindAsync(m => m.GroupId == groupId && m.IsActive);
        var inside = members.Select(m => m.UserId).ToHashSet();
        if (ownerUserId is { } owner)
            inside.Add(owner);

        return requests
            .Where(r => r.Status != MembershipRequestStatus.Pending || !inside.Contains(r.MusicianUserId))
            .ToList();
    }
}

public sealed class GetMyMembershipRequestsQueryHandler(IUnitOfWorkGroups unitOfWork, IUsersModuleApi users)
    : IQueryHandler<GetMyMembershipRequestsQuery, GroupsResult<List<GroupMembershipRequestResponse>>>
{
    public async Task<GroupsResult<List<GroupMembershipRequestResponse>>> Handle(
        GetMyMembershipRequestsQuery query,
        CancellationToken cancellationToken)
    {
        var requests = await unitOfWork.MembershipRequests.ListByMusicianAsync(
            query.MusicianUserId,
            query.Direction,
            query.Status,
            cancellationToken);

        var groupIds = requests.Select(r => r.GroupId).Distinct().ToList();
        var groups = new Dictionary<long, Group>();
        foreach (var groupId in groupIds)
        {
            var group = await unitOfWork.Groups.GetByIdAsync(groupId);
            if (group is not null)
                groups[group.Id] = group;
        }

        var responses = await MembershipRequestResponses.BuildAsync(
            requests,
            groups,
            users,
            viewerIsGroupSide: false,
            cancellationToken);

        return GroupsResult<List<GroupMembershipRequestResponse>>.Success(responses);
    }
}
