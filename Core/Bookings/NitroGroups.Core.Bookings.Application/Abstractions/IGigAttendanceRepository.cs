using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;

namespace NitroGroups.Core.Bookings.Application.Abstractions;

public interface IGigAttendanceRepository : IGenericRepository<GigAttendance, long>
{
    /// <summary>Respuestas de esos toques, de todos los miembros del grupo.</summary>
    Task<List<GigAttendance>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        CancellationToken cancellationToken = default);

    /// <summary>Respuestas de un solo usuario a esos toques (su agenda).</summary>
    Task<List<GigAttendance>> ListByEventRequestsAsync(
        IReadOnlyCollection<long> eventRequestIds,
        long userId,
        CancellationToken cancellationToken = default);
}
