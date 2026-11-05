using AutoMapper;
using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetBySlug
{
    public record GetGroupBySlugQuery(string Slug) : IQuery<Result<GroupResponse>>;

    public class GetGroupBySlugQueryHandler(IUnitOfWorkGroups unitOfWork, IMapper mapper) : IQueryHandler<GetGroupBySlugQuery, Result<GroupResponse>>
    {
        private readonly IUnitOfWorkGroups _unitOfWork = unitOfWork;
        private readonly IMapper _mapper = mapper;

        public async Task<Result<GroupResponse>> Handle(GetGroupBySlugQuery query, CancellationToken cancellationToken)
        {
            var groups = await _unitOfWork.Groups.FindAsync(g => g.Slug == query.Slug);
            var group = groups.FirstOrDefault();

            if (group is null)
                return "Group not found.";

            var response = _mapper.Map<GroupResponse>(group);

            // "Integrantes" no es un número que se escriba: son los lugares ocupados del equipo.
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
