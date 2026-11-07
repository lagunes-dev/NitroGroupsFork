using Cortex.Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using NitroGroups.Core.Users.Application.UseCases.Musicians.SearchOpenToJoin;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.EndpointMapping;
using static Microsoft.AspNetCore.Http.Results;

namespace NitroGroups.Core.Users.Infrastructure.Endpoints.Musicians
{
    /// <summary>
    /// Búsqueda de músicos abiertos a unirse (S2). Es privada: la usa el manager para invitar.
    /// La respuesta es un resumen sin email.
    /// </summary>
    public class SearchOpenToJoin : IEndpoint
    {
        public void MapEndpoint(IEndpointRouteBuilder app)
        {
            app.MapGet("api/musicians/open-to-join", async (
                    IMediator mediator,
                    string? query,
                    int page = 1,
                    int size = 10) =>
                {
                    var result = await mediator.SendQueryAsync<SearchOpenMusiciansQuery, PagedResult<OpenMusicianSummary>>(
                        new SearchOpenMusiciansQuery(query, page, size));
                    return Ok(result);
                })
                .WithTags("Musicians");
        }
    }
}
