using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;

namespace NitroGroups.Core.Groups.Application.Abstractions;

/// <summary>Lectura y registro de las visitas de un grupo al perfil de un músico (S9).</summary>
public interface IProfileVisitRepository : IGenericRepository<GroupProfileVisit, long>
{
    /// <summary>La visita de ese grupo a ese músico, o null si nunca lo miró.</summary>
    Task<GroupProfileVisit?> GetAsync(long groupId, long musicianUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Registra la visita y la guarda. Si el grupo ya había mirado a ese músico, mueve
    /// <c>LastVisitedAt</c> en la fila que existe: el conteo del músico no se infla al refrescar.
    /// </summary>
    Task RecordAsync(long groupId, long musicianUserId, CancellationToken cancellationToken = default);

    /// <summary>Todas las visitas que recibió ese músico, la más reciente primero.</summary>
    Task<List<GroupProfileVisit>> ListForMusicianAsync(long musicianUserId, CancellationToken cancellationToken = default);
}
