using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetTeam;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetPublicTeam;

/// <summary>
/// El equipo con caras del perfil público (S14, revisada en L24): los miembros activos del grupo
/// con nombre, rol e instrumento · ciudad, sin correos. Es la versión anónima de
/// <c>GetGroupTeamQuery</c>: mismo orden. El oficio se publica para todo el equipo: el interruptor
/// "Aparecer en el directorio y aceptar invitaciones" gobierna el directorio y las invitaciones,
/// nunca la plantilla del grupo.
/// </summary>
public sealed record GetPublicGroupTeamQuery(long GroupId) : IQuery<GroupsResult<List<PublicGroupTeamMemberResponse>>>;

public sealed class GetPublicGroupTeamQueryHandler(IUnitOfWorkGroups unitOfWork, IUsersModuleApi users)
    : IQueryHandler<GetPublicGroupTeamQuery, GroupsResult<List<PublicGroupTeamMemberResponse>>>
{
    private const string GroupNotFoundMessage = "Grupo no encontrado.";

    public async Task<GroupsResult<List<PublicGroupTeamMemberResponse>>> Handle(
        GetPublicGroupTeamQuery query,
        CancellationToken cancellationToken)
    {
        if (await unitOfWork.Groups.GetByIdAsync(query.GroupId) is null)
            return GroupsResult<List<PublicGroupTeamMemberResponse>>.NotFound(GroupNotFoundMessage);

        // Una membresía dada de baja no es parte del equipo, y el orden es el mismo del manager.
        var rows = (await unitOfWork.GroupMembers.FindAsync(
                member => member.GroupId == query.GroupId && member.IsActive))
            .ByTeamOrder()
            .ToList();
        if (rows.Count == 0)
            return GroupsResult<List<PublicGroupTeamMemberResponse>>.Success([]);

        var memberIds = rows.Select(row => row.UserId).Distinct().ToList();
        var userMap = await users.GetUsersAsync(memberIds, cancellationToken);

        // Instrumento y ciudad viven en el perfil del músico. El resumen no filtra por IsOpenToJoin,
        // y así debe ser: el oficio de la plantilla se publica para todos, sin preguntar por el
        // interruptor de cada uno (que solo gobierna el directorio y las invitaciones).
        var musicianMap = await users.GetMusicianSummariesAsync(memberIds, cancellationToken);

        var team = new List<PublicGroupTeamMemberResponse>(rows.Count);
        foreach (var row in rows)
        {
            var user = userMap.GetValueOrDefault(row.UserId);
            var musician = musicianMap.GetValueOrDefault(row.UserId);

            team.Add(new PublicGroupTeamMemberResponse
            {
                UserId = row.UserId,
                // Este endpoint es público: sin nombre el renglón queda vacío, nunca la parte local
                // del correo. Quien no cargó nada aparece vacío, no con un dato inventado.
                FullName = user?.FullName ?? string.Empty,
                Role = row.Role.ToString(),
                Instruments = musician?.Instruments,
                City = musician?.City
            });
        }

        return GroupsResult<List<PublicGroupTeamMemberResponse>>.Success(team);
    }
}
