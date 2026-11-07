using Cortex.Mediator.Commands;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.ProfileVisits.Record;

/// <param name="GroupId">El grupo de la ruta: el endpoint ya exige <c>RequireGroupManager</c>.</param>
/// <param name="MusicianUserId">El músico cuyo perfil se abrió, también de la ruta.</param>
/// <param name="ViewerUserId">Siempre el usuario del token; el cuerpo no puede elegirlo.</param>
public sealed record RecordProfileVisitCommand(long GroupId, long MusicianUserId, long ViewerUserId)
    : ICommand<GroupsResult<bool>>;

/// <summary>
/// Un manager abre el perfil público de un músico: queda una visita (S9). Nada de lo que manda el
/// cliente se guarda salvo el par (grupo, músico) que el endpoint ya autorizó: ni el email del
/// músico, ni la fecha, ni quién dice ser el visitante.
/// </summary>
public sealed class RecordProfileVisitCommandHandler(
    IUnitOfWorkGroups unitOfWork,
    IProfileVisitRepository visits,
    IUsersModuleApi users,
    IGroupsModuleApi groups)
    : ICommandHandler<RecordProfileVisitCommand, GroupsResult<bool>>
{
    public async Task<GroupsResult<bool>> Handle(RecordProfileVisitCommand command, CancellationToken cancellationToken)
    {
        // Un manager mirándose a sí mismo no es una visita: nadie se avisa a sí mismo.
        if (command.ViewerUserId == command.MusicianUserId)
            return GroupsResult<bool>.Validation("No puedes registrar una visita a tu propio perfil.");

        // El filtro del endpoint ya lo exige; la regla se queda junto a la escritura para que
        // ninguna otra vía pueda crear una visita a nombre de un grupo que no se administra.
        if (!await groups.CanManageGroupAsync(command.GroupId, command.ViewerUserId, cancellationToken))
            return GroupsResult<bool>.Forbidden("No administras este grupo.");

        var group = await unitOfWork.Groups.GetByIdAsync(command.GroupId);
        if (group is null)
            return GroupsResult<bool>.NotFound("Grupo no encontrado.");

        // Un grupo que ya no está en la plataforma no deja visitas: nadie vería su nombre.
        if (!group.Active)
            return GroupsResult<bool>.Conflict("Este grupo no está activo en la plataforma.");

        var musician = await users.GetUserAsync(command.MusicianUserId, cancellationToken);
        if (musician is null)
            return GroupsResult<bool>.NotFound("Músico no encontrado.");

        if (musician.UserType != UserType.Musician)
            return GroupsResult<bool>.Validation("Solo se puede visitar el perfil de un músico.");

        await visits.RecordAsync(command.GroupId, command.MusicianUserId, cancellationToken);
        return GroupsResult<bool>.Success(true);
    }
}
