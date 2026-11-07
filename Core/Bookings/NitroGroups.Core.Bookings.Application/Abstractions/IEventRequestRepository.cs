using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.Abstractions;

public interface IEventRequestRepository : IGenericRepository<EventRequest, long>
{
    /// <summary>La solicitud con sus mensajes (ordenados del más viejo al más nuevo), o null.</summary>
    Task<EventRequest?> GetWithMessagesAsync(long id, CancellationToken cancellationToken = default);

    /// <summary>Solicitudes enviadas por un cliente, las más nuevas primero.</summary>
    Task<List<EventRequest>> ListByClientAsync(long clientUserId, CancellationToken cancellationToken = default);

    /// <summary>Solicitudes recibidas por un grupo, las más nuevas primero.</summary>
    Task<List<EventRequest>> ListByGroupAsync(long groupId, EventRequestStatus? status, CancellationToken cancellationToken = default);

    /// <summary>
    /// Toques (solicitudes aceptadas) de esos grupos cuya fecha es igual o posterior a
    /// <paramref name="fromEventDate"/>, ordenados por fecha y luego por hora de inicio.
    /// </summary>
    Task<List<EventRequest>> ListAcceptedGigsAsync(IReadOnlyCollection<long> groupIds, DateOnly fromEventDate, CancellationToken cancellationToken = default);

    /// <summary>La solicitud con las respuestas de asistencia de sus miembros, o null.</summary>
    Task<EventRequest?> GetWithAttendanceAsync(long id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Los toques <b>aceptados</b> de ese grupo en ese día, sin contar la solicitud indicada
    /// (la del hilo que se está mirando), ordenados por id. Es la base del choque de fecha (D6).
    /// </summary>
    Task<List<EventRequest>> ListAcceptedOnDateAsync(
        long groupId,
        DateOnly eventDate,
        long excludeEventRequestId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Los toques <b>aceptados</b> de esos grupos en esos días, en una sola lectura. Es la base del
    /// choque de fecha de una lista (T29): una página de N filas no dispara N consultas.
    /// </summary>
    Task<List<EventRequest>> ListAcceptedOnDatesAsync(
        IReadOnlyCollection<long> groupIds,
        IReadOnlyCollection<DateOnly> eventDates,
        CancellationToken cancellationToken = default);
}
