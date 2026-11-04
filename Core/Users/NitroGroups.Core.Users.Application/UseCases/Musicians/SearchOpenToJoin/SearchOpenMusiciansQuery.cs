using Cortex.Mediator.Queries;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;

namespace NitroGroups.Core.Users.Application.UseCases.Musicians.SearchOpenToJoin
{
    /// <summary>Búsqueda por nombre de músicos abiertos a unirse a un grupo (S2).</summary>
    public sealed record SearchOpenMusiciansQuery(
        string? Query,
        int Page = 1,
        int Size = 10) : IQuery<PagedResult<OpenMusicianSummary>>;

    public sealed class SearchOpenMusiciansQueryHandler(IUnitOfWorkUser unitOfWork)
        : IQueryHandler<SearchOpenMusiciansQuery, PagedResult<OpenMusicianSummary>>
    {
        public const int MaxPageSize = 48;

        public async Task<PagedResult<OpenMusicianSummary>> Handle(SearchOpenMusiciansQuery query, CancellationToken cancellationToken)
        {
            var page = Math.Max(1, query.Page);
            var size = Math.Clamp(query.Size, 1, MaxPageSize);
            var text = string.IsNullOrWhiteSpace(query.Query) ? null : query.Query.Trim();

            return await unitOfWork.OpenMusicians.SearchAsync(text, page, size, cancellationToken);
        }
    }
}
