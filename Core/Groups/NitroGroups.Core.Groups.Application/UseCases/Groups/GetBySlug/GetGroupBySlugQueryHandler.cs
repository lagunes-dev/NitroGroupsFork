using AutoMapper;
using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.GetBySlug
{
    /// <summary>
    /// El perfil público de un grupo: lo que ve cualquier visitante, autenticado o no. Devuelve
    /// <see cref="PublicGroupResponse"/>, que no declara cómo pagar: ese acuerdo es entre el grupo y
    /// su cliente (ronda 9), no un dato del perfil público.
    /// </summary>
    public record GetGroupBySlugQuery(string Slug) : IQuery<Result<PublicGroupResponse>>;

    public class GetGroupBySlugQueryHandler(IUnitOfWorkGroups unitOfWork, IMapper mapper) : IQueryHandler<GetGroupBySlugQuery, Result<PublicGroupResponse>>
    {
        private readonly IUnitOfWorkGroups _unitOfWork = unitOfWork;
        private readonly IMapper _mapper = mapper;

        public async Task<Result<PublicGroupResponse>> Handle(GetGroupBySlugQuery query, CancellationToken cancellationToken)
        {
            var groups = await _unitOfWork.Groups.FindAsync(g => g.Slug == query.Slug);
            var group = groups.FirstOrDefault();

            if (group is null)
                return "Group not found.";

            var response = _mapper.Map<PublicGroupResponse>(group);

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
