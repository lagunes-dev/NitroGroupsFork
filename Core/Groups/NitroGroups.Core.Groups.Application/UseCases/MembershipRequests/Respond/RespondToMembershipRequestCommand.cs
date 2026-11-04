using Cortex.Mediator.Commands;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Respond;

public enum MembershipRequestDecision
{
    Accept,
    Decline,
    Cancel
}

/// <param name="UserId">Siempre el usuario del token (lo pone el endpoint).</param>
public sealed record RespondToMembershipRequestCommand(long Id, long UserId, MembershipRequestDecision Decision)
    : ICommand<GroupsResult<GroupMembershipRequestResponse>>;

/// <summary>
/// Aceptar, rechazar o cancelar una invitación/solicitud. El papel se calcula con la solicitud
/// guardada (nunca con la ruta): quien no participa recibe 404, quien participa sin el papel
/// correcto recibe 403. Al aceptar se crea o se reactiva la fila de miembro con rol Member (S3).
/// </summary>
public sealed class RespondToMembershipRequestCommandHandler(
    IUnitOfWorkGroups unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time) : ICommandHandler<RespondToMembershipRequestCommand, GroupsResult<GroupMembershipRequestResponse>>
{
    private const string NotFoundMessage = "Solicitud no encontrada.";

    public async Task<GroupsResult<GroupMembershipRequestResponse>> Handle(
        RespondToMembershipRequestCommand command,
        CancellationToken cancellationToken)
    {
        var request = await unitOfWork.MembershipRequests.GetByIdAsync(command.Id);
        if (request is null)
            return GroupsResult<GroupMembershipRequestResponse>.NotFound(NotFoundMessage);

        var isInvitedMusician = request.MusicianUserId == command.UserId;
        var isInitiator = request.InitiatedByUserId == command.UserId;
        // Misma regla que el filtro RequireGroupManager (Owner o Manager activo del grupo).
        var canManage = await groups.CanManageGroupAsync(request.GroupId, command.UserId, cancellationToken);

        // Los ajenos no deben saber que la solicitud existe.
        if (!isInvitedMusician && !isInitiator && !canManage)
            return GroupsResult<GroupMembershipRequestResponse>.NotFound(NotFoundMessage);

        if (!IsAllowed(command.Decision, request.Direction, isInvitedMusician, isInitiator, canManage))
            return GroupsResult<GroupMembershipRequestResponse>.Forbidden(ForbiddenMessage(command.Decision, request.Direction));

        var group = await unitOfWork.Groups.GetByIdAsync(request.GroupId);
        if (group is null)
            return GroupsResult<GroupMembershipRequestResponse>.NotFound("Grupo no encontrado.");

        try
        {
            switch (command.Decision)
            {
                case MembershipRequestDecision.Accept:
                    request.Accept(command.UserId);
                    break;
                case MembershipRequestDecision.Decline:
                    request.Decline(command.UserId);
                    break;
                default:
                    request.Cancel(command.UserId);
                    break;
            }
        }
        catch (InvalidGroupMembershipTransitionException ex)
        {
            return GroupsResult<GroupMembershipRequestResponse>.Conflict(ex.Message);
        }

        if (command.Decision == MembershipRequestDecision.Accept)
            await AddOrReactivateMemberAsync(request, command.UserId, cancellationToken);

        try
        {
            await unitOfWork.CompleteAsync();
        }
        catch (ConcurrencyConflictException)
        {
            // Otra persona respondió o canceló a la vez: solo gana el primer guardado.
            return GroupsResult<GroupMembershipRequestResponse>.Conflict(
                "La solicitud cambió mientras la respondías. Recarga para ver su estado actual.");
        }

        var response = await MembershipRequestResponses.BuildAsync(
            request,
            group,
            users,
            viewerIsGroupSide: !isInvitedMusician,
            cancellationToken);

        return GroupsResult<GroupMembershipRequestResponse>.Success(response);
    }

    /// <summary>Cancela solo quien la inició; aceptar/rechazar, el lado que la recibe.</summary>
    private static bool IsAllowed(
        MembershipRequestDecision decision,
        MembershipDirection direction,
        bool isInvitedMusician,
        bool isInitiator,
        bool canManage)
        => decision switch
        {
            MembershipRequestDecision.Cancel => isInitiator,
            MembershipRequestDecision.Accept or MembershipRequestDecision.Decline =>
                direction == MembershipDirection.Invitation ? isInvitedMusician : canManage,
            _ => false
        };

    private static string ForbiddenMessage(MembershipRequestDecision decision, MembershipDirection direction)
    {
        if (decision == MembershipRequestDecision.Cancel)
            return "Solo quien inició la solicitud puede cancelarla.";

        return direction == MembershipDirection.Invitation
            ? "Solo el músico invitado puede responder la invitación."
            : "Solo el Owner o un Manager del grupo puede responder la solicitud.";
    }

    /// <summary>
    /// S3: entra siempre como Member (un Manager no se escala permisos invitando). Si ya existe una
    /// fila inactiva para ese (grupo, usuario) se reactiva en vez de insertar otra: el índice único
    /// (group_id, user_id) es real.
    /// </summary>
    private async Task AddOrReactivateMemberAsync(
        GroupMembershipRequest request,
        long approvedByUserId,
        CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var joinedVia = request.Direction == MembershipDirection.Invitation
            ? JoinedVia.Invitation
            : JoinedVia.Request;

        var existing = (await unitOfWork.GroupMembers.FindAsync(
            m => m.GroupId == request.GroupId && m.UserId == request.MusicianUserId)).FirstOrDefault();

        if (existing is null)
        {
            await unitOfWork.GroupMembers.CreateAsync(new GroupMember
            {
                GroupId = request.GroupId,
                UserId = request.MusicianUserId,
                Role = GroupMemberRole.Member,
                IsActive = true,
                JoinedAt = now,
                JoinedVia = joinedVia,
                ApprovedBy = (int)approvedByUserId
            });
            return;
        }

        existing.Role = GroupMemberRole.Member;
        existing.IsActive = true;
        existing.LeftAt = null;
        existing.JoinedAt = now;
        existing.JoinedVia = joinedVia;
        existing.ApprovedBy = (int)approvedByUserId;
        unitOfWork.GroupMembers.Update(existing);
    }
}
