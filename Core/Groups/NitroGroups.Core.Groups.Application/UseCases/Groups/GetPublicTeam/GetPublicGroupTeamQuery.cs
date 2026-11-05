using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetTeam;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetPublicTeam;

/// <summary>
/// El equipo con caras del perfil público (S14): los miembros activos del grupo con nombre, rol e
/// instrumento · ciudad, sin correos. Es la versión anónima de <c>GetGroupTeamQuery</c>: mismo
/// orden, pero el oficio de quien cerró su perfil no se publica.
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
        // así que la decisión de publicar el oficio se toma acá, en el camino de lectura.
        var musicianMap = await users.GetMusicianSummariesAsync(memberIds, cancellationToken);

        var team = new List<PublicGroupTeamMemberResponse>(rows.Count);
        foreach (var row in rows)
        {
            var user = userMap.GetValueOrDefault(row.UserId);
            var musician = musicianMap.GetValueOrDefault(row.UserId);

            // S14: el perfil cerrado se lee con nombre y rol, pero sin instrumento ni ciudad.
            var publishesCraft = musician is not null
                && await users.IsMusicianOpenToJoinAsync(row.UserId, cancellationToken);

            team.Add(new PublicGroupTeamMemberResponse
            {
                UserId = row.UserId,
                // Este endpoint es público: sin nombre el renglón queda vacío, nunca la parte local
                // del correo. Quien no cargó nada aparece vacío, no con un dato inventado.
                FullName = user?.FullName ?? string.Empty,
                Role = row.Role.ToString(),
                Instruments = publishesCraft ? musician!.Instruments : null,
                City = publishesCraft ? musician!.City : null
            });
        }

        return GroupsResult<List<PublicGroupTeamMemberResponse>>.Success(team);
    }
}
