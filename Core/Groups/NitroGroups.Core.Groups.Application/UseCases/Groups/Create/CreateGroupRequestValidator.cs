using FluentValidation;
using NitroGroups.Shared.Contracts.Groups.Requests;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.Create;

public class CreateGroupRequestValidator : AbstractValidator<CreateGroupRequest>
{
    public CreateGroupRequestValidator()
    {
        RuleFor(x => x.Slug)
            .NotEmpty()
            .WithMessage("Slug cannot be empty.")
            .MaximumLength(120)
            .WithMessage("Slug cannot exceed 120 characters.")
            .Matches(@"^[a-z0-9\-]+$")
            .WithMessage("Slug must only contain lowercase letters, numbers, and hyphens.");

        RuleFor(x => x.GroupName)
            .NotEmpty()
            .WithMessage("GroupName cannot be empty.")
            .MaximumLength(150)
            .WithMessage("GroupName cannot exceed 150 characters.");

        RuleFor(x => x.Email)
            .EmailAddress()
            .When(x => !string.IsNullOrEmpty(x.Email))
            .WithMessage("Invalid email format.")
            .MaximumLength(150)
            .WithMessage("Email cannot exceed 150 characters.");

        RuleFor(x => x.Phone)
            .MaximumLength(20)
            .WithMessage("Phone cannot exceed 20 characters.");

        // Ronda 9: cómo pagar es texto libre, con tope. La app no valida datos bancarios ni cobra.
        RuleFor(x => x.PaymentInstructions)
            .MaximumLength(500)
            .WithMessage("Cómo pagar no puede pasar de 500 caracteres.");

        RuleFor(x => x.LocationText)
            .MaximumLength(200)
            .WithMessage("LocationText cannot exceed 200 characters.");

        RuleFor(x => x.ServiceRadiusKm)
            .GreaterThanOrEqualTo(0)
            .WithMessage("ServiceRadiusKm must be non-negative.");

        RuleFor(x => x.Currency)
            .NotEmpty()
            .MaximumLength(3)
            .WithMessage("Currency must be a 3-letter code.");

        RuleFor(x => x.BasePrice)
            .GreaterThanOrEqualTo(0)
            .When(x => x.BasePrice.HasValue)
            .WithMessage("BasePrice must be non-negative.");

        RuleFor(x => x.HourlyRate)
            .GreaterThanOrEqualTo(0)
            .When(x => x.HourlyRate.HasValue)
            .WithMessage("HourlyRate must be non-negative.");

        RuleFor(x => x.MinimumDurationHours)
            .GreaterThanOrEqualTo(1)
            .WithMessage("MinimumDurationHours must be at least 1.");
    }
}
