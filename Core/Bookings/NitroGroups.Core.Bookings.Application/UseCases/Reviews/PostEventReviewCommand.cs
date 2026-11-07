using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Reviews;

/// <param name="EventRequestId">El evento de la ruta.</param>
/// <param name="ClientUserId">Siempre el usuario del token (lo pone el endpoint).</param>
public sealed record PostEventReviewCommand(long EventRequestId, long ClientUserId, int? Rating, string? Comment)
    : ICommand<BookingResult<EventReviewResponse>>;

/// <summary>
/// S5: solo escribe la reseña el cliente de un evento aceptado, cuya fecha ya pasó (hora de
/// México), que no sea autorreserva y que no tenga reseña. Una por evento.
/// </summary>
public sealed class PostEventReviewCommandHandler(IUnitOfWorkBookings unitOfWork, TimeProvider time)
    : ICommandHandler<PostEventReviewCommand, BookingResult<EventReviewResponse>>
{
    internal const string NotFoundMessage = "Solicitud no encontrada.";
    internal const string InvalidRatingMessage = "La calificación debe estar entre 1 y 5.";
    internal const string CommentTooLongMessage = "El comentario no puede pasar de 1000 caracteres.";
    internal const string SelfBookedMessage = "No puedes reseñar un evento que reservó el propio grupo.";
    internal const string NotAcceptedMessage = "Todavía no puedes reseñar este evento: el grupo aún no lo ha aceptado.";
    internal const string NotPastMessage = "Todavía no puedes reseñar este evento: la fecha aún no ha pasado.";
    internal const string AlreadyReviewedMessage = "Ya escribiste una reseña para este evento.";

    public async Task<BookingResult<EventReviewResponse>> Handle(PostEventReviewCommand command, CancellationToken cancellationToken)
    {
        var request = await unitOfWork.EventRequests.GetByIdAsync(command.EventRequestId);
        if (request is null || request.ClientUserId != command.ClientUserId)
            return BookingResult<EventReviewResponse>.Failure(BookingErrorKind.NotFound, NotFoundMessage);

        if (command.Rating is not (>= EventReview.MinRating and <= EventReview.MaxRating))
            return Invalid(InvalidRatingMessage);

        var comment = string.IsNullOrWhiteSpace(command.Comment) ? null : command.Comment.Trim();
        if (comment is { Length: > EventReview.MaxCommentLength })
            return Invalid(CommentTooLongMessage);

        // El estado del evento se lee de la fila guardada, nunca de la petición.
        if (request.IsSelfBooked)
            return Conflict(SelfBookedMessage);
        if (request.Status != EventRequestStatus.Accepted)
            return Conflict(NotAcceptedMessage);
        if (request.EventDate >= MexicoTime.Today(time))
            return Conflict(NotPastMessage);
        if (await unitOfWork.EventReviews.GetByEventRequestAsync(request.Id, cancellationToken) is not null)
            return Conflict(AlreadyReviewedMessage);

        var review = new EventReview
        {
            EventRequestId = request.Id,
            ClientUserId = command.ClientUserId,
            GroupId = request.GroupId,
            Rating = command.Rating.Value,
            Comment = comment
        };

        await unitOfWork.EventReviews.CreateAsync(review);
        review.RaisePostedEvent();
        await unitOfWork.OutboxService.SaveEventsAsync(review.DomainEvents); // guarda la reseña + el evento juntos
        review.ClearDomainEvents();

        return BookingResult<EventReviewResponse>.Success(new EventReviewResponse
        {
            Rating = review.Rating,
            Comment = review.Comment,
            CreatedAt = review.CreatedAt
        });
    }

    private static BookingResult<EventReviewResponse> Invalid(string message)
        => BookingResult<EventReviewResponse>.Failure(BookingErrorKind.Validation, message);

    private static BookingResult<EventReviewResponse> Conflict(string message)
        => BookingResult<EventReviewResponse>.Failure(BookingErrorKind.Conflict, message);
}
