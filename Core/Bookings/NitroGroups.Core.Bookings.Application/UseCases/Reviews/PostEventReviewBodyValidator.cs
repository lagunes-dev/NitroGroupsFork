using FluentValidation;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Requests;

namespace NitroGroups.Core.Bookings.Application.UseCases.Reviews;

public sealed class PostEventReviewBodyValidator : AbstractValidator<PostEventReviewBody>
{
    public PostEventReviewBodyValidator()
    {
        RuleFor(x => x.Rating).Must(r => r is >= EventReview.MinRating and <= EventReview.MaxRating)
            .WithMessage("La calificación debe estar entre 1 y 5.");
        RuleFor(x => x.Comment).MaximumLength(EventReview.MaxCommentLength)
            .WithMessage("El comentario no puede pasar de 1000 caracteres.");
    }
}
