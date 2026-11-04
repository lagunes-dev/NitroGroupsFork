using Cortex.Mediator.Commands;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.RequestToJoin;

/// <param name="RequesterUserId">Siempre el usuario del token (lo pone el endpoint), nunca el body.</param>
public sealed record RequestToJoinGroupCommand(long GroupId, long RequesterUserId, string? Message)
    : ICommand<GroupsResult<GroupMembershipRequestResponse>>;

/// <summary>
/// Un músico pide unirse a un grupo (S1). No mira <c>IsOpenToJoin</c>: esa bandera solo limita
/// las invitaciones que el grupo puede mandar.
/// </summary>
public sealed class RequestToJoinGroupCommandHandler(IUnitOfWorkGroups unitOfWork, IUsersModuleApi users)
    : ICommandHandler<RequestToJoinGroupCommand, GroupsResult<GroupMembershipRequestResponse>>
{
    public async Task<GroupsResult<GroupMembershipRequestResponse>> Handle(
        RequestToJoinGroupCommand command,
        CancellationToken cancellationToken)
    {
        var group = await unitOfWork.Groups.GetByIdAsync(command.GroupId);
        if (group is null)
            return GroupsResult<GroupMembershipRequestResponse>.NotFound("Grupo no encontrado.");

        if (!group.Active)
            return GroupsResult<GroupMembershipRequestResponse>.Conflict("Este grupo no está activo en la plataforma.");

        var requester = await users.GetUserAsync(command.RequesterUserId, cancellationToken);
        if (requester is null)
            return GroupsResult<GroupMembershipRequestResponse>.NotFound("Usuario no encontrado.");

        if (requester.UserType != UserType.Musician)
            return GroupsResult<GroupMembershipRequestResponse>.Forbidden("Solo los músicos pueden pedir unirse a un grupo.");

        if (await PendingMembershipRequests.IsActiveMemberAsync(unitOfWork, group, command.RequesterUserId, cancellationToken))
            return GroupsResult<GroupMembershipRequestResponse>.Conflict("Ya eres miembro de este grupo.");

        return await PendingMembershipRequests.CreateAsync(
            unitOfWork,
            users,
            group,
            command.RequesterUserId,
            command.RequesterUserId,
            MembershipDirection.Request,
            command.Message,
            cancellationToken);
    }
}
