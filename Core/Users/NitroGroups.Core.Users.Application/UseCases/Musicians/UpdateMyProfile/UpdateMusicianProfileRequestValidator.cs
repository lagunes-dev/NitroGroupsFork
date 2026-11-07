using FluentValidation;
using NitroGroups.Shared.Contracts.Users.Requests;

namespace NitroGroups.Core.Users.Application.UseCases.Musicians.UpdateMyProfile;

/// <summary>Lengths match the columns of <c>users.musicians</c>.</summary>
public sealed class UpdateMusicianProfileRequestValidator : AbstractValidator<UpdateMusicianProfileRequest>
{
    public UpdateMusicianProfileRequestValidator()
    {
        RuleFor(request => request.Headline)
            .MaximumLength(120)
            .WithMessage("Headline cannot exceed 120 characters.");

        RuleFor(request => request.ShortBio)
            .MaximumLength(800)
            .WithMessage("ShortBio cannot exceed 800 characters.");

        RuleFor(request => request.Instruments)
            .MaximumLength(120)
            .WithMessage("Instruments cannot exceed 120 characters.");

        RuleFor(request => request.VideoUrl)
            .MaximumLength(300)
            .WithMessage("VideoUrl cannot exceed 300 characters.");

        RuleFor(request => request.City)
            .MaximumLength(80)
            .WithMessage("City cannot exceed 80 characters.");

        RuleFor(request => request.YearsExperience)
            .GreaterThanOrEqualTo(0)
            .WithMessage("YearsExperience must be a non-negative value.");
    }
}
