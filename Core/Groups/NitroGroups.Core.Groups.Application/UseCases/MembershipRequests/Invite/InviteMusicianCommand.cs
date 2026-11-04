using Cortex.Mediator.Commands;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;

/// <param name="InvitedByUserId">Siempre el usuario del token (lo pone el endpoint), nunca el body.</param>
public sealed record InviteMusicianCommand(long GroupId, long InvitedByUserId, long MusicianUserId, string? Message)
    : ICommand<GroupsResult<GroupMembershipRequestResponse>>;

/// <summary>
/// Un Owner/Manager invita a un músico (S1). El endpoint ya exige <c>RequireGroupManager</c>;
/// aquí se valida a quién se invita y que no haya ya una solicitud pendiente.
/// </summary>
public sealed class InviteMusicianCommandHandler(IUnitOfWorkGroups unitOfWork, IUsersModuleApi users)
    : ICommandHandler<InviteMusicianCommand, GroupsResult<GroupMembershipRequestResponse>>
{
    public async Task<GroupsResult<GroupMembershipRequestResponse>> Handle(
        InviteMusicianCommand command,
        CancellationToken cancellationToken)
    {
        var group = await unitOfWork.Groups.GetByIdAsync(command.GroupId);
        if (group is null)
            return GroupsResult<GroupMembershipRequestResponse>.NotFound("Grupo no encontrado.");

        if (!group.Active)
            return GroupsResult<GroupMembershipRequestResponse>.Conflict("Este grupo no está activo en la plataforma.");

        var musician = await users.GetUserAsync(command.MusicianUserId, cancellationToken);
        if (musician is null)
            return GroupsResult<GroupMembershipRequestResponse>.NotFound("Músico no encontrado.");

        if (musician.UserType != UserType.Musician)
            return GroupsResult<GroupMembershipRequestResponse>.Validation("Solo se puede invitar a músicos.");

        // S2: invitaciones solo a quien está abierto a unirse (el dato vive en el módulo Users).
        if (!await users.IsMusicianOpenToJoinAsync(command.MusicianUserId, cancellationToken))
            return GroupsResult<GroupMembershipRequestResponse>.Conflict("Este músico no está abierto a unirse a grupos.");

        if (await PendingMembershipRequests.IsActiveMemberAsync(unitOfWork, group, command.MusicianUserId, cancellationToken))
            return GroupsResult<GroupMembershipRequestResponse>.Conflict("Ese músico ya es miembro del grupo.");

        return await PendingMembershipRequests.CreateAsync(
            unitOfWork,
            users,
            group,
            command.MusicianUserId,
            command.InvitedByUserId,
            MembershipDirection.Invitation,
            command.Message,
            cancellationToken);
    }
}
