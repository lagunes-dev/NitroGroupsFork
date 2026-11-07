using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;

namespace NitroGroups.Core.Bookings.Application.Abstractions;

public interface IGigNoticeRepository : IGenericRepository<GigNotice, long>
{
    /// <summary>El aviso del músico de ese tipo y ese día, si ya lo mandó (la regla de uno por día).</summary>
    Task<GigNotice?> FindByDayAsync(
        long eventRequestId,
        long userId,
        GigNoticeKind kind,
        DateOnly sentOn,
        CancellationToken cancellationToken = default);

    /// <summary>Los avisos que el músico mandó hoy, en el orden en que los mandó.</summary>
    Task<List<GigNotice>> ListByUserAndDayAsync(
        long userId,
        DateOnly sentOn,
        CancellationToken cancellationToken = default);

    /// <summary>Los avisos de los toques del grupo, del más reciente al más antiguo.</summary>
    Task<List<GigNotice>> ListByGroupAsync(long groupId, CancellationToken cancellationToken = default);
}
