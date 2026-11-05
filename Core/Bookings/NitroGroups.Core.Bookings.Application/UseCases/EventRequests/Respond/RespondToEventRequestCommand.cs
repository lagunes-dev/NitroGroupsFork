using NitroGroups.Shared.Abstractions.Repository;
using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Respond;

public enum EventRequestDecision
{
    Accept,
    Decline
}

/// <summary>El grupo acepta o rechaza. Solo un Owner/Manager del grupo de la solicitud.</summary>
public sealed record RespondToEventRequestCommand(long Id, long UserId, EventRequestDecision Decision, string? Message)
    : ICommand<BookingResult<EventRequestResponse>>;

public sealed class RespondToEventRequestCommandHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time) : ICommandHandler<RespondToEventRequestCommand, BookingResult<EventRequestResponse>>
{
    public async Task<BookingResult<EventRequestResponse>> Handle(RespondToEventRequestCommand command, CancellationToken cancellationToken)
    {
        var request = await unitOfWork.EventRequests.GetWithMessagesAsync(command.Id, cancellationToken);
        if (request is null)
            return BookingResult<EventRequestResponse>.NotFound();

        // El permiso se calcula con el grupo guardado en la solicitud, no con nada de la petición.
        var participation = await EventRequestParticipation.ResolveAsync(request, command.UserId, groups, cancellationToken);
        if (!participation.IsManager)
        {
            return participation.IsClient
                ? BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Forbidden, "Solo el grupo puede aceptar o rechazar la solicitud.")
                : BookingResult<EventRequestResponse>.NotFound();
        }

        var now = time.GetUtcNow().UtcDateTime;
        try
        {
            if (command.Decision == EventRequestDecision.Accept)
                request.Accept(command.Message, now);
            else
                request.Decline(command.Message, now);
        }
        catch (InvalidEventRequestTransitionException ex)
        {
            return BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Conflict, ex.Message);
        }

        try
        {
            await unitOfWork.OutboxService.SaveEventsAsync(request.DomainEvents); // guarda estado + evento juntos
            request.ClearDomainEvents();
            await unitOfWork.CompleteAsync();
        }
        catch (ConcurrencyConflictException)
        {
            // Otra persona respondió o canceló al mismo tiempo: solo gana el primer guardado.
            return BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Conflict, "La solicitud cambió mientras la respondías. Recarga para ver su estado actual.");
        }

        var response = await EventRequestResponses.BuildAsync(
            request, groups, users, unitOfWork.EventReviews, time, command.UserId, includeMessages: true, cancellationToken);
        return BookingResult<EventRequestResponse>.Success(response);
    }
}
