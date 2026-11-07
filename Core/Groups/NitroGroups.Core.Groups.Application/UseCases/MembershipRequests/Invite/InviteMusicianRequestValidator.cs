using FluentValidation;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Requests;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;

public sealed class InviteMusicianRequestValidator : AbstractValidator<InviteMusicianRequest>
{
    public InviteMusicianRequestValidator()
    {
        RuleFor(r => r.MusicianUserId)
            .GreaterThan(0)
            .WithMessage("Indica el músico que quieres invitar.");

        RuleFor(r => r.Message)
            .MaximumLength(GroupMembershipRequest.MaxMessageLength)
            .WithMessage($"El mensaje no puede exceder {GroupMembershipRequest.MaxMessageLength} caracteres.");
    }
}
