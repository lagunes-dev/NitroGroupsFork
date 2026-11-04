using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests;

/// <summary>
/// Reglas compartidas por los dos sentidos (S1): una sola solicitud pendiente por (grupo, músico),
/// y la misma forma de guardarla. La usan invitar y pedir unirse.
/// </summary>
internal static class PendingMembershipRequests
{
    internal const string DuplicateMessage = "Ya hay una solicitud pendiente entre este grupo y este músico.";

    /// <summary>true si el usuario ya pertenece activamente al grupo (por fila o por ser el dueño).</summary>
    public static async Task<bool> IsActiveMemberAsync(
        IUnitOfWorkGroups unitOfWork,
        Group group,
        long userId,
        CancellationToken cancellationToken)
    {
        if (group.OwnerUserId == userId)
            return true;

        var members = await unitOfWork.GroupMembers.FindAsync(m => m.GroupId == group.Id && m.UserId == userId);
        return members.Any(m => m.IsActive);
    }

    public static async Task<GroupsResult<GroupMembershipRequestResponse>> CreateAsync(
        IUnitOfWorkGroups unitOfWork,
        IUsersModuleApi users,
        Group group,
        long musicianUserId,
        long initiatedByUserId,
        MembershipDirection direction,
        string? message,
        CancellationToken cancellationToken)
    {
        var pending = await unitOfWork.MembershipRequests.GetPendingAsync(group.Id, musicianUserId, cancellationToken);
        if (pending is not null)
            return GroupsResult<GroupMembershipRequestResponse>.Conflict(DuplicateMessage);

        GroupMembershipRequest request;
        try
        {
            request = GroupMembershipRequest.Create(group.Id, musicianUserId, initiatedByUserId, direction, message);
        }
        catch (ArgumentException ex)
        {
            return GroupsResult<GroupMembershipRequestResponse>.Validation(ex.Message);
        }

        // El índice único parcial decide si dos peticiones simultáneas se cruzaron.
        if (!await unitOfWork.MembershipRequests.TryCreatePendingAsync(request, cancellationToken))
            return GroupsResult<GroupMembershipRequestResponse>.Conflict(DuplicateMessage);

        // El evento lleva el Id, así que se levanta después de guardar (mismo orden que Bookings).
        request.RaiseCreatedEvent();
        await unitOfWork.OutboxService.SaveEventsAsync(request.DomainEvents);
        request.ClearDomainEvents();

        var response = await MembershipRequestResponses.BuildAsync(
            request,
            group,
            users,
            viewerIsGroupSide: direction == MembershipDirection.Invitation,
            cancellationToken);

        return GroupsResult<GroupMembershipRequestResponse>.Success(response);
    }
}
