using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Infrastructure.Adapters;

/// <summary>Implementación in-process de la API pública del módulo Bookings.</summary>
internal sealed class BookingsModuleApi(BookingsDbContext context) : IBookingsModuleApi
{
    public async Task<IReadOnlySet<long>> GetBusyGroupIdsAsync(
        IReadOnlyCollection<long> groupIds,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        if (groupIds.Count == 0)
            return new HashSet<long>();

        var ids = groupIds.ToList();

        // Un evento es agenda solo cuando la solicitud está aceptada (Pending, Declined y
        // Cancelled nunca lo son). Dos eventos aceptados el mismo día devuelven el id una vez.
        var busy = await context.EventRequests.AsNoTracking()
            .Where(r => ids.Contains(r.GroupId)
                && r.Status == EventRequestStatus.Accepted
                && r.EventDate == date)
            .Select(r => r.GroupId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return busy.ToHashSet();
    }
}
