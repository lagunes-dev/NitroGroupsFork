using AutoMapper;
using Cortex.Mediator.Commands;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.Update
{
    public record UpdateGroupCommand(
        long Id,
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
        string? ProfilePictureUrl,
        string? CoverImageUrl,
        // Ronda 9: cómo quiere el grupo que se le pague. Opcional para no romper a quien ya construye
        // el comando sin él; el valor lo normaliza la entidad.
        string? PaymentInstructions = null) : ICommand<Result<GroupResponse>>;

    public class UpdateGroupCommandHandler(IUnitOfWorkGroups unitOfWork, IMapper mapper) : ICommandHandler<UpdateGroupCommand, Result<GroupResponse>>
    {
        private readonly IUnitOfWorkGroups _unitOfWork = unitOfWork;
        private readonly IMapper _mapper = mapper;

        public async Task<Result<GroupResponse>> Handle(UpdateGroupCommand command, CancellationToken cancellationToken)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(command.Id);

            if (group == null)
                return "Group not found.";

            _mapper.Map(command, group);

            // El texto de cómo pagar no lo copia el mapeo: lo guarda la entidad, que normaliza el
            // vacío a null y solo mueve la fecha de actualización cuando el texto cambió de verdad.
            group.SetPaymentInstructions(command.PaymentInstructions, DateTime.UtcNow);

            _unitOfWork.Groups.Update(group);
            await _unitOfWork.CompleteAsync();

            // Recargar con includes para devolver genres y media
            var updatedGroups = await _unitOfWork.Groups.FindWithIncludesAsync(
                g => g.Id == command.Id,
                g => g.Genres,
                g => g.Media);
            var updatedGroup = updatedGroups.FirstOrDefault() ?? group;

            return _mapper.Map<GroupResponse>(updatedGroup);
        }
    }
}
