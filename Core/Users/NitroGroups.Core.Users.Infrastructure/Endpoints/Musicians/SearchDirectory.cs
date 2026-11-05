using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Users.Application.UseCases.Musicians.SearchDirectory;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.EndpointMapping;
using static Microsoft.AspNetCore.Http.Results;

namespace NitroGroups.Core.Users.Infrastructure.Endpoints.Musicians
{
    /// <summary>
    /// S1, S2: the public directory of musicians open to join. It is anonymous (it is in the public
    /// allowlist of the security tests) and its items never carry an email.
    /// </summary>
    public class SearchDirectory : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
        {
            app.MapGet("api/musicians", async (
                    IMediator mediator,
                    string? query,
                    string? instrument,
                    string? city,
                    int page = 1,
                    int size = 12) =>
                {
                    var result = await mediator.SendQueryAsync<SearchMusicianDirectoryQuery, PagedResult<MusicianDirectoryItem>>(
                        new SearchMusicianDirectoryQuery(query, instrument, city, page, size));
                    return Ok(result);
                })
                .AllowAnonymous()
                .WithTags("Musicians");
        }
    }
}
