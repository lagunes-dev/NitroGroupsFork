using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application.UseCases.Reviews;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// <c>GET api/groups/{groupId}/reviews</c>: público (sin token), con el resumen calculado con las
/// filas reales, la página pedida y el autor como "Nombre A." (nunca su correo).
/// </summary>
public class GroupReviewsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _anonymous;
    private readonly IMediator _mediator;

    public GroupReviewsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _mediator = factory.Mediator;
    }

    private static GroupReviewsResponse Page() => new()
    {
        Summary = new GroupReviewSummaryResponse { Average = 4.5m, Count = 2 },
        Items =
        [
            new GroupReviewItemResponse
            {
                Rating = 5, Comment = "Excelente", CreatedAt = new DateTime(2026, 10, 21, 18, 0, 0, DateTimeKind.Utc),
                EventType = "Boda", AuthorName = "Ana L."
            }
        ],
        TotalCount = 2,
        PageNumber = 1,
        PageSize = 10,
        HasNextPage = false,
        HasPreviousPage = false
    };

    [Fact]
    public async Task ListadoPublico_EsAnonimo_YDevuelveResumenPaginaSinCorreos()
    {
        GetGroupReviewsQuery? sent = null;
        _mediator.SendQueryAsync<GetGroupReviewsQuery, GroupReviewsResponse>(Arg.Do<GetGroupReviewsQuery>(q => sent = q))
            .Returns(Page());

        var response = await _anonymous.GetAsync("api/groups/10/reviews?page=2&size=5");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(sent);
        Assert.Equal(10L, sent.GroupId);
        Assert.Equal(2, sent.Page);
        Assert.Equal(5, sent.Size);

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("@", body); // ni correos ni "Nombre A." con arroba

        using var json = JsonDocument.Parse(body);
        var root = json.RootElement;
        Assert.Equal(["summary", "items", "totalCount", "pageNumber", "pageSize", "hasNextPage", "hasPreviousPage"],
            root.EnumerateObject().Select(p => p.Name));
        var summary = root.GetProperty("summary");
        Assert.Equal(["average", "count"], summary.EnumerateObject().Select(p => p.Name));
        Assert.Equal(4.5m, summary.GetProperty("average").GetDecimal());
        Assert.Equal(2, summary.GetProperty("count").GetInt32());

        var item = root.GetProperty("items")[0];
        Assert.Equal(["rating", "comment", "createdAt", "eventType", "authorName"],
            item.EnumerateObject().Select(p => p.Name));
        Assert.Equal(5, item.GetProperty("rating").GetInt32());
        Assert.Equal("Excelente", item.GetProperty("comment").GetString());
        Assert.Equal("Boda", item.GetProperty("eventType").GetString());
        Assert.Equal("Ana L.", item.GetProperty("authorName").GetString());
        Assert.Equal(2, root.GetProperty("totalCount").GetInt32());
        Assert.Equal(1, root.GetProperty("pageNumber").GetInt32());
        Assert.Equal(10, root.GetProperty("pageSize").GetInt32());
    }

    [Fact]
    public async Task ListadoPublico_SinParametros_UsaLaPrimeraPaginaDeDiez()
    {
        GetGroupReviewsQuery? sent = null;
        _mediator.SendQueryAsync<GetGroupReviewsQuery, GroupReviewsResponse>(Arg.Do<GetGroupReviewsQuery>(q => sent = q))
            .Returns(Page());

        var response = await _anonymous.GetAsync("api/groups/10/reviews");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal((1, 10), (sent!.Page, sent.Size));
    }
}
