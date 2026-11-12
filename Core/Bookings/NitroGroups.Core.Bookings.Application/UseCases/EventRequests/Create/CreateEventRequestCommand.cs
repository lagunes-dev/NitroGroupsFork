using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Create;

/// <param name="ClientUserId">Siempre el usuario del token (lo pone el endpoint).</param>
public sealed record CreateEventRequestCommand(
    long ClientUserId,
    long GroupId,
    DateOnly EventDate,
    TimeOnly? StartTime,
    int DurationHours,
    string EventType,
    string LocationText,
    int? GuestCount,
    decimal? Budget,
    string Message) : ICommand<BookingResult<EventRequestResponse>>;

public sealed class CreateEventRequestCommandHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    ISchedulesModuleApi schedules,
    TimeProvider time) : ICommandHandler<CreateEventRequestCommand, BookingResult<EventRequestResponse>>
{
    public async Task<BookingResult<EventRequestResponse>> Handle(CreateEventRequestCommand command, CancellationToken cancellationToken)
    {
        var group = await groups.GetGroupAsync(command.GroupId, cancellationToken);
        if (group is null)
            return BookingResult<EventRequestResponse>.Failure(BookingErrorKind.NotFound, "Grupo no encontrado.");

        if (!group.IsActive)
            return BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Conflict, "Este grupo no está activo en la plataforma.");

        if (!group.IsAcceptingBookings)
            return BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Conflict, "Este grupo no está recibiendo solicitudes por ahora.");

        if (command.EventDate < MexicoTime.Today(time))
            return BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Validation, "La fecha del evento no puede ser anterior a hoy.");

        // Ronda 13 (petición 29): el mismo cliente no pide el mismo grupo dos veces para la misma fecha
        // mientras la anterior siga viva. Dos filas iguales en "Mis pedidos" no eran un pedido nuevo, eran
        // un duplicado. Una rechazada o cancelada es un cierre: ahí el cliente sí puede volver a intentarlo.
        var live = await unitOfWork.EventRequests.ListLiveForClientOnDateAsync(
            command.ClientUserId, command.GroupId, command.EventDate, cancellationToken);
        if (live.Count > 0)
        {
            var alreadyConfirmed = live.Any(r => r.Status == EventRequestStatus.Accepted);
            return BookingResult<EventRequestResponse>.Failure(
                BookingErrorKind.Conflict,
                alreadyConfirmed
                    ? "Ya tienes ese día confirmado con este grupo."
                    : "Ya tienes una solicitud con este grupo para esa fecha.");
        }

        var (from, to) = MexicoTime.LocalDay(command.EventDate);
        var unavailable = await schedules.GetUnavailableGroupIdsAsync([command.GroupId], from, to, cancellationToken);
        if (unavailable.Contains(command.GroupId))
            return BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Conflict, "El grupo no está disponible en esa fecha.");

        var request = new EventRequest
        {
            GroupId = command.GroupId,
            ClientUserId = command.ClientUserId,
            EventDate = command.EventDate,
            StartTime = command.StartTime,
            DurationHours = command.DurationHours,
            EventType = command.EventType.Trim(),
            LocationText = command.LocationText.Trim(),
            GuestCount = command.GuestCount,
            Budget = command.Budget,
            Currency = "MXN",
            Message = command.Message.Trim(),
            // Permitido (decisión de producto), pero marcado para excluirlo de las métricas públicas.
            IsSelfBooked = await groups.CanManageGroupAsync(command.GroupId, command.ClientUserId, cancellationToken)
        };

        await unitOfWork.EventRequests.CreateAsync(request);
        await unitOfWork.CompleteAsync(); // genera el Id que viaja en el evento

        request.RaiseCreatedEvent();
        await unitOfWork.OutboxService.SaveEventsAsync(request.DomainEvents);
        request.ClearDomainEvents();

        var response = await EventRequestResponses.BuildAsync(
            request, groups, users, unitOfWork.EventReviews, time, command.ClientUserId, includeMessages: true, cancellationToken);
        return BookingResult<EventRequestResponse>.Success(response);
    }
}
