using FluentValidation;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Requests;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.RequestToJoin;

public sealed class RequestToJoinGroupRequestValidator : AbstractValidator<RequestToJoinGroupRequest>
{
    public RequestToJoinGroupRequestValidator()
    {
        RuleFor(r => r.Message)
            .MaximumLength(GroupMembershipRequest.MaxMessageLength)
            .WithMessage($"El mensaje no puede exceder {GroupMembershipRequest.MaxMessageLength} caracteres.");
    }
}
