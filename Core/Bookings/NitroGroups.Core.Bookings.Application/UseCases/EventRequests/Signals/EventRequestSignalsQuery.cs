using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Signals;

/// <param name="GroupId">El grupo de la ruta: el endpoint ya exige <c>RequireGroupManager</c> sobre él.</param>
/// <param name="EventRequestId">La solicitud del hilo; si no es de ese grupo, 404.</param>
public sealed record GetEventRequestSignalsQuery(long GroupId, long EventRequestId)
    : IQuery<BookingResult<EventRequestSignalsResponse>>;

/// <summary>
/// D6: las dos señales del hilo del manager, calculadas con datos que ya existen.
/// Choque de fecha: otro toque <b>aceptado</b> del mismo grupo el mismo día. La fecha del evento
/// se guarda como día de calendario (<c>date</c>) y ya está expresada en hora de México —la misma
/// regla con la que se creó y se muestra—, así que comparar dos <see cref="DateOnly"/> es comparar
/// ese día en México; no hay ningún instante UTC que convertir aquí.
/// Presupuesto: lo que ofrece el cliente frente al "desde $X" del grupo. La app solo compara:
/// no cobra, no suma y no mueve dinero.
/// </summary>
public sealed class GetEventRequestSignalsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups)
    : IQueryHandler<GetEventRequestSignalsQuery, BookingResult<EventRequestSignalsResponse>>
{
    public async Task<BookingResult<EventRequestSignalsResponse>> Handle(
        GetEventRequestSignalsQuery query,
        CancellationToken cancellationToken)
    {
        var request = await unitOfWork.EventRequests.GetByIdAsync(query.EventRequestId);

        // Una solicitud de otro grupo no se revela: 404, igual que el resto del módulo.
        if (request is null || request.GroupId != query.GroupId)
            return BookingResult<EventRequestSignalsResponse>.NotFound();

        var sameDayGigs = await unitOfWork.EventRequests.ListAcceptedOnDateAsync(
            query.GroupId, request.EventDate, request.Id, cancellationToken);
        var otherGig = sameDayGigs.FirstOrDefault();

        var group = await groups.GetGroupAsync(query.GroupId, cancellationToken);

        return BookingResult<EventRequestSignalsResponse>.Success(new EventRequestSignalsResponse
        {
            DateClash = new DateClashSignalResponse
            {
                Clashes = otherGig is not null,
                WithGig = otherGig is null
                    ? null
                    : new ClashingGigResponse
                    {
                        Id = otherGig.Id,
                        EventType = otherGig.EventType,
                        LocationText = otherGig.LocationText
                    }
            },
            Budget = new BudgetSignalResponse
            {
                Offered = request.Budget,
                BaseRate = group?.BasePrice,
                Currency = group?.Currency,
                Status = Compare(request.Budget, group?.BasePrice)
            }
        });
    }

    private static string Compare(decimal? offered, decimal? baseRate) => (offered, baseRate) switch
    {
        (null, _) or (_, null) => BudgetSignalResponse.StatusUnknown,
        var (o, b) when o > b => BudgetSignalResponse.StatusAbove,
        var (o, b) when o < b => BudgetSignalResponse.StatusBelow,
        _ => BudgetSignalResponse.StatusEqual
    };
}
