using Cortex.Mediator.Queries;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Core.Users.Application.UseCases.Musicians.SearchOpenToJoin;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;

namespace NitroGroups.Core.Users.Application.UseCases.Musicians.SearchDirectory;

/// <summary>
/// S1, S2: the public directory of musicians open to join. Every filter is optional; an empty or
/// blank value means "no filter".
/// </summary>
public sealed record SearchMusicianDirectoryQuery(
    string? Query,
    string? Instrument,
    string? City,
    int Page = 1,
    int Size = 12) : IQuery<PagedResult<MusicianDirectoryItem>>;

public sealed class SearchMusicianDirectoryQueryHandler(IUnitOfWorkUser unitOfWork)
    : IQueryHandler<SearchMusicianDirectoryQuery, PagedResult<MusicianDirectoryItem>>
{
    public async Task<PagedResult<MusicianDirectoryItem>> Handle(
        SearchMusicianDirectoryQuery query, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.Size, 1, SearchOpenMusiciansQueryHandler.MaxPageSize);

        return await unitOfWork.OpenMusicians.SearchDirectoryAsync(
            Normalize(query.Query), Normalize(query.Instrument), Normalize(query.City), page, size, cancellationToken);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
