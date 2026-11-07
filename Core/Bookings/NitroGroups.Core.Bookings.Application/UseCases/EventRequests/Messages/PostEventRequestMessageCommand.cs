using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;
using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Messages;

/// <summary>Mensaje dentro de la solicitud. Solo el cliente o un manager del grupo; si no, 404.</summary>
public sealed record PostEventRequestMessageCommand(long Id, long UserId, string Body)
    : ICommand<BookingResult<EventRequestMessageResponse>>;

public sealed class PostEventRequestMessageCommandHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time) : ICommandHandler<PostEventRequestMessageCommand, BookingResult<EventRequestMessageResponse>>
{
    public async Task<BookingResult<EventRequestMessageResponse>> Handle(PostEventRequestMessageCommand command, CancellationToken cancellationToken)
    {
        var request = await unitOfWork.EventRequests.GetWithMessagesAsync(command.Id, cancellationToken);
        if (request is null)
            return BookingResult<EventRequestMessageResponse>.NotFound();

        var participation = await EventRequestParticipation.ResolveAsync(request, command.UserId, groups, cancellationToken);
        if (!participation.IsParticipant)
            return BookingResult<EventRequestMessageResponse>.NotFound();

        var party = participation.IsClient ? EventRequestParty.Client : EventRequestParty.Group;
        EventRequestMessage message;
        try
        {
            message = request.PostMessage(command.UserId, party, command.Body.Trim(), time.GetUtcNow().UtcDateTime);
        }
        catch (InvalidEventRequestTransitionException ex)
        {
            return BookingResult<EventRequestMessageResponse>.Failure(BookingErrorKind.Conflict, ex.Message);
        }

        try
        {
            await unitOfWork.OutboxService.SaveEventsAsync(request.DomainEvents); // guarda el mensaje + evento juntos
            request.ClearDomainEvents();
            await unitOfWork.CompleteAsync();
        }
        catch (ConcurrencyConflictException)
        {
            // Otra persona respondió o canceló al mismo tiempo: solo gana el primer guardado.
            return BookingResult<EventRequestMessageResponse>.Failure(BookingErrorKind.Conflict, "La solicitud cambió mientras escribías. Recarga y vuelve a enviar tu mensaje.");
        }

        var response = await EventRequestResponses.BuildAsync(
            request, groups, users, unitOfWork.EventReviews, time, command.UserId, includeMessages: true, cancellationToken);
        return BookingResult<EventRequestMessageResponse>.Success(response.Messages!.Single(m => m.Id == message.Id));
    }
}
