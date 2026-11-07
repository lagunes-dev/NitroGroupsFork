using AutoMapper;
using Cortex.Mediator.Commands;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.Create
{
    public record CreateGroupCommand(
        long OwnerUserId,
        string Slug,
        string GroupName,
        string Description,
        string Biography,
        int NumMembers,
        int YearsExperience,
        string Phone,
        string Email,
        string LocationText,
        int ServiceRadiusKm,
        string Currency,
        decimal? BasePrice,
        decimal? HourlyRate,
        int MinimumDurationHours,
        int SetupTimeMinutes,
        bool IsAcceptingBookings,
        bool Active,
        // Ronda 9: cómo quiere el grupo que se le pague. Opcional para no romper a quien ya construye
        // el comando sin él; el valor lo normaliza la entidad.
        string? PaymentInstructions = null) : ICommand<Result<GroupResponse>>;

    public class CreateGroupCommandHandler(IUnitOfWorkGroups unitOfWork, IMapper mapper) : ICommandHandler<CreateGroupCommand, Result<GroupResponse>>
    {
        private readonly IUnitOfWorkGroups _unitOfWork = unitOfWork;
        private readonly IMapper _mapper = mapper;

        public async Task<Result<GroupResponse>> Handle(CreateGroupCommand command, CancellationToken cancellationToken)
        {
            // Check if slug already exists
            var existing = await _unitOfWork.Groups.FindAsync(g => g.Slug == command.Slug);
            if (existing.Any())
                return "Ya existe un grupo con este nombre/slug.";

            // Map command to entity
            var group = _mapper.Map<Group>(command);
            group.AverageRating = 0;
            group.TotalReviews = 0;
            group.ViewCount = 0;
            group.BookingCount = 0;
            group.IsVerified = false;
            group.IsFeatured = false;
            // Ronda 9: si el grupo ya dice cómo pagarle, la nota del cliente lleva su fecha desde el día uno.
            group.SetPaymentInstructions(command.PaymentInstructions, DateTime.UtcNow);

            await _unitOfWork.Groups.CreateAsync(group);

            // El dueño entra como miembro. Se enlaza por la navegación y no por GroupId: el grupo
            // todavía no tiene id (lo asigna la base al guardar) y EF Core lo copia en el orden correcto.
            var ownerMember = new GroupMember
            {
                Group = group,
                UserId = command.OwnerUserId,
                Role = GroupMemberRole.Owner,
                IsActive = true,
                JoinedAt = DateTime.UtcNow,
                JoinedVia = JoinedVia.Manual
            };
            await _unitOfWork.GroupMembers.CreateAsync(ownerMember);

            await _unitOfWork.CompleteAsync();

            return _mapper.Map<GroupResponse>(group);
        }
    }
}
