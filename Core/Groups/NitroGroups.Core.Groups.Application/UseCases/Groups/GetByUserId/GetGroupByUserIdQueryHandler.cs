using AutoMapper;
using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetByUserId
{
    public record GetGroupByUserIdQuery(long UserId) : IQuery<Result<GroupResponse?>>;
    public class GetGroupByUserIdQueryHandler(IUnitOfWorkGroups unitOfWork, IMapper mapper) : IQueryHandler<GetGroupByUserIdQuery, Result<GroupResponse?>>
    {
        private readonly IUnitOfWorkGroups _unitOfWork = unitOfWork;
        private readonly IMapper _mapper = mapper;
        public async Task<Result<GroupResponse?>> Handle(GetGroupByUserIdQuery query, CancellationToken cancellationToken)
        {
            // Only active Owner/Manager rows manage a group; a plain Member must not get its management panel.
            var members = await _unitOfWork.GroupMembers.FindAsync(member =>
                member.UserId == query.UserId
                && member.IsActive
                && (member.Role == GroupMemberRole.Owner || member.Role == GroupMemberRole.Manager));
            var groupId = members
                .OrderBy(member => member.Role == GroupMemberRole.Owner ? 0 : 1)
                .ThenBy(member => member.JoinedAt)
                .Select(member => member.GroupId)
                .FirstOrDefault();

            if (groupId == 0)
                return "No se encontro ningun grupo que perteneciera al usuario";

            var group = await _unitOfWork.Groups.GetByIdAsync(groupId);

            if (group == null)
                return "No se encontro ningun grupo que perteneciera al usuario";

            var response = _mapper.Map<GroupResponse>(group);

            // "Integrantes" se toma del equipo real, igual que en el perfil público: el número que el
            // dueño escribió a mano ya no puede contradecir a las membresías activas.
            response.NumMembers = (await _unitOfWork.GroupMembers.FindAsync(
                member => member.GroupId == group.Id && member.IsActive)).Count();

            var genres = await _unitOfWork.GroupGenres.FindWithIncludesAsync(
                gg => gg.GroupId == group.Id,
                gg => gg.Genre);
            var media = await _unitOfWork.GroupMedia.FindAsync(gm => gm.GroupId == group.Id);

            response.Genres = _mapper.Map<List<GenreResponse>>(genres.ToList());
            response.Media = _mapper.Map<List<GroupMediaResponse>>(media.ToList());

            return response;
        }
    }
}
