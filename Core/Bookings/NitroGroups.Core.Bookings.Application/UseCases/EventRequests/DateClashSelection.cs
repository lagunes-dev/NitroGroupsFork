using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests;

/// <summary>
/// D6/S11: el choque de fecha en un solo lugar, para que la fila de la lista y el hilo del manager
/// no puedan decir cosas distintas. Un choque es otro toque <b>aceptado</b> del mismo grupo el
/// mismo día; los días son de calendario (hora de México), así que comparar fechas basta.
/// </summary>
public static class DateClashSelection
{
    /// <summary>
    /// Entre los toques aceptados de ese día, el que de verdad se pisa con la solicitud cuando las
    /// horas de los dos lo permiten; si no se puede saber, el más temprano. Null si no hay ninguno.
    /// </summary>
    public static EventRequest? Pick(EventRequest request, IEnumerable<EventRequest> sameDayAccepted)
    {
        var candidates = sameDayAccepted.Where(gig => gig.Id != request.Id).ToList();
        if (candidates.Count == 0)
            return null;

        return EarliestFirst(candidates.Where(gig => Overlaps(request, gig))).FirstOrDefault()
            ?? EarliestFirst(candidates).First();
    }

    /// <summary>
    /// El hecho tal como viaja en la respuesta del hilo: sin otro toque, <c>Clashes</c> en false y
    /// <c>WithGig</c> en null, porque el hilo siempre muestra la señal.
    /// </summary>
    public static DateClashSignalResponse Signal(EventRequest? otherGig) => new()
    {
        Clashes = otherGig is not null,
        WithGig = WithGig(otherGig)
    };

    /// <summary>
    /// El hecho para una fila de la lista: sin choque es null, y un null no viaja, así que la fila
    /// del cliente queda exactamente como siempre.
    /// </summary>
    public static DateClashSignalResponse? SignalOrNull(EventRequest? otherGig)
        => otherGig is null ? null : Signal(otherGig);

    private static ClashingGigResponse? WithGig(EventRequest? otherGig)
        => otherGig is null
            ? null
            : new ClashingGigResponse
            {
                Id = otherGig.Id,
                EventType = otherGig.EventType,
                LocationText = otherGig.LocationText,
                // Reloj de 24 horas: una boda de las 20:00 no puede viajar como "08:00" (ronda 5).
                StartTime = otherGig.StartTime?.ToString(@"HH\:mm"),
                DurationHours = otherGig.DurationHours
            };

    /// <summary>El más temprano primero; sin hora de inicio, después de los que sí la tienen.</summary>
    private static IOrderedEnumerable<EventRequest> EarliestFirst(IEnumerable<EventRequest> gigs)
        => gigs.OrderBy(gig => gig.StartTime is null).ThenBy(gig => gig.StartTime).ThenBy(gig => gig.Id);

    /// <summary>
    /// Dos toques se pisan si sus intervalos se cruzan. Se comparan minutos desde la medianoche para
    /// que un toque que termina después de las 00:00 siga dentro de su propio intervalo. Sin hora de
    /// inicio no se puede saber, y entonces no se afirma nada.
    /// </summary>
    private static bool Overlaps(EventRequest request, EventRequest gig)
    {
        if (request.StartTime is not { } requestStart || gig.StartTime is not { } gigStart)
            return false;
        if (request.DurationHours <= 0 || gig.DurationHours <= 0)
            return false;

        var requestBegins = Minutes(requestStart);
        var gigBegins = Minutes(gigStart);
        return requestBegins < gigBegins + gig.DurationHours * 60
            && gigBegins < requestBegins + request.DurationHours * 60;
    }

    private static int Minutes(TimeOnly time) => time.Hour * 60 + time.Minute;
}
