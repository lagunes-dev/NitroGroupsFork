using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;

namespace NitroGroups.Core.Users.Infrastructure.Adapters
{
    /// <summary>Implementación in-process de la API pública del módulo Users.</summary>
    internal sealed class UsersModuleApi(UsersDbContext context, IOpenMusicianSearchRepository openMusicians) : IUsersModuleApi
    {
        public async Task<long?> GetUserIdByAuth0IdAsync(string auth0Id, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(auth0Id))
                return null;

            return await context.Users.AsNoTracking()
                .Where(u => u.Auth0Id == auth0Id && u.Active)
                .Select(u => (long?)u.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<UserSummary?> GetUserAsync(long userId, CancellationToken cancellationToken = default)
        {
            var users = await GetUsersAsync([userId], cancellationToken);
            return users.GetValueOrDefault(userId);
        }

        public async Task<IReadOnlyDictionary<long, UserSummary>> GetUsersAsync(IEnumerable<long> userIds, CancellationToken cancellationToken = default)
        {
            var ids = userIds.Distinct().ToList();
            if (ids.Count == 0)
                return new Dictionary<long, UserSummary>();

            return await context.Users.AsNoTracking()
                .Where(u => ids.Contains(u.Id))
                .Select(u => new UserSummary(u.Id, u.Email, u.FirstName, u.LastName, u.UserType, u.ProfilePictureUrl))
                .ToDictionaryAsync(u => u.Id, cancellationToken);
        }

        public async Task<IReadOnlyDictionary<long, OpenMusicianSummary>> GetMusicianSummariesAsync(
            IEnumerable<long> userIds,
            CancellationToken cancellationToken = default)
        {
            var summaries = await openMusicians.GetSummariesByUserIdsAsync(userIds.Distinct().ToList(), cancellationToken);
            return summaries.ToDictionary(summary => summary.UserId);
        }

        public Task<bool> IsMusicianOpenToJoinAsync(long userId, CancellationToken cancellationToken = default)
            => context.Musicians.AsNoTracking()
                .AnyAsync(m => m.UserId == userId
                    && m.IsOpenToJoin
                    && m.User.UserType == UserType.Musician
                    && m.User.Active, cancellationToken);
    }
}
