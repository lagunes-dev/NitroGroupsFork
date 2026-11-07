using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;

namespace NitroGroups.Core.Users.Application.Abstractions
{
    /// <summary>
    /// Lectura del directorio de músicos como resumen sin email. Toda proyección de este
    /// repositorio usa <see cref="OpenMusicianSummary"/>, nunca la columna de correo.
    /// </summary>
    public interface IOpenMusicianSearchRepository
    {
        /// <summary>
        /// Músicos con <c>IsOpenToJoin = true</c> cuyo usuario está activo; <paramref name="text"/>
        /// filtra por nombre, apellido o "nombre apellido" sin importar mayúsculas.
        /// </summary>
        Task<PagedResult<OpenMusicianSummary>> SearchAsync(
            string? text,
            int page,
            int size,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Resumen por id de usuario, sin filtrar por <c>IsOpenToJoin</c>: una invitación
        /// pendiente debe poder mostrar el nombre aunque el músico haya cerrado su perfil.
        /// </summary>
        Task<IReadOnlyList<OpenMusicianSummary>> GetSummariesByUserIdsAsync(
            IReadOnlyCollection<long> userIds,
            CancellationToken cancellationToken = default);
    }
}
