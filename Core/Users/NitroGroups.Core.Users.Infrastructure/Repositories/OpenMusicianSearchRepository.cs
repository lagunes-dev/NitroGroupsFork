using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;
using System.Linq.Expressions;

namespace NitroGroups.Core.Users.Infrastructure.Repositories
{
    /// <summary>
    /// Directorio de músicos para invitar (S2). La proyección solo usa columnas públicas:
    /// el email del usuario nunca se selecciona.
    /// </summary>
    internal sealed class OpenMusicianSearchRepository(UsersDbContext context) : IOpenMusicianSearchRepository
    {
        private static readonly Expression<Func<Musician, OpenMusicianSummary>> SummaryProjection = m =>
            new OpenMusicianSummary
            {
                UserId = m.UserId,
                FullName = (m.User.FirstName + " " + m.User.LastName).Trim(),
                ProfilePictureUrl = m.User.ProfilePictureUrl,
                YearsExperience = m.YearsExperience
            };

        public async Task<PagedResult<OpenMusicianSummary>> SearchAsync(
            string? text,
            int page,
            int size,
            CancellationToken cancellationToken = default)
        {
            var query = Apply(text);

            var total = await query.CountAsync(cancellationToken);

            // El offset se calcula en long: una página enorme da una página vacía, no un overflow.
            var skip = (long)(page - 1) * size;
            if (skip >= total)
                return new PagedResult<OpenMusicianSummary>([], total, page, size);

            var items = await query
                .OrderBy(m => m.User.FirstName)
                .ThenBy(m => m.User.LastName)
                .ThenBy(m => m.UserId) // desempate estable entre páginas
                .Skip((int)skip)
                .Take(size)
                .Select(SummaryProjection)
                .ToListAsync(cancellationToken);

            return new PagedResult<OpenMusicianSummary>(items, total, page, size);
        }

        public async Task<IReadOnlyList<OpenMusicianSummary>> GetSummariesByUserIdsAsync(
            IReadOnlyCollection<long> userIds,
            CancellationToken cancellationToken = default)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0)
                return [];

            return await context.Musicians.AsNoTracking()
                .Where(m => ids.Contains(m.UserId))
                .OrderBy(m => m.User.FirstName)
                .ThenBy(m => m.User.LastName)
                .ThenBy(m => m.UserId)
                .Select(SummaryProjection)
                .ToListAsync(cancellationToken);
        }

        private IQueryable<Musician> Apply(string? text)
        {
            var query = context.Musicians.AsNoTracking().Where(m => m.IsOpenToJoin && m.User.Active);

            if (text is { } value)
            {
                var lowered = value.ToLowerInvariant();
                query = query.Where(m =>
                    m.User.FirstName.ToLower().Contains(lowered)
                    || m.User.LastName.ToLower().Contains(lowered)
                    || (m.User.FirstName + " " + m.User.LastName).ToLower().Contains(lowered));
            }

            return query;
        }
    }
}
