using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Reviews;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// D7: el listado público de reseñas del grupo. Se calcula con las filas reales de
/// <c>bookings.event_reviews</c>: la más reciente primero, paginado y sin datos de contacto.
/// </summary>
public class GroupReviewsIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private static readonly DateOnly Past = new(2026, 10, 20);

    private readonly IntegrationTestFixture _fixture = fixture;

    private Task<BookingResult<EventReviewResponse>> ReviewAsync(
        BookingsDbContext context,
        long eventId,
        long clientId = ClientId,
        int? rating = 5,
        string? comment = null)
        => new PostEventReviewCommandHandler(
                _fixture.CreateBookingsUnitOfWork(context, _fixture.CreateBookingsOutbox(context)), new BookingsTestScenario().Time)
            .Handle(new PostEventReviewCommand(eventId, clientId, rating, comment), CancellationToken.None);

    private Task<GroupReviewsResponse> ReviewsAsync(BookingsDbContext context, long groupId, int page = 1, int size = 10)
        => new GetGroupReviewsQueryHandler(_fixture.CreateBookingsUnitOfWork(context), new BookingsTestScenario().Users)
            .Handle(new GetGroupReviewsQuery(groupId, page, size), CancellationToken.None);

    /// <summary>Un toque del grupo que el cliente puede reseñar: aceptado y con fecha pasada.</summary>
    private static Task<EventRequest> SeedReviewableAsync(
        BookingsDbContext context,
        long clientId = ClientId,
        bool selfBooked = false)
        => SeedAsync(context, clientId: clientId, eventDate: Past, configure: request =>
        {
            request.IsSelfBooked = selfBooked;
            request.Accept(null, Now.UtcDateTime);
        });

    /// <summary>La reseña se guarda directo en el contexto para poder fijar su fecha.</summary>
    private static async Task<EventReview> SeedReviewAsync(
        BookingsDbContext context,
        long eventId,
        long clientId = ClientId,
        int rating = 5,
        DateTime? createdAt = null,
        long groupId = GroupId)
    {
        var review = new EventReview
        {
            EventRequestId = eventId,
            GroupId = groupId,
            ClientUserId = clientId,
            Rating = rating,
            Comment = $"[seed] reseña {eventId}",
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
        context.EventReviews.Add(review);
        await context.SaveChangesAsync();
        return review;
    }

    [Fact]
    public async Task ElClienteResenaSuEventoPasado_YLaResenaApareceEnElListadoPublicoDelGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context);

        var result = await ReviewAsync(context, gig.Id, rating: 5, comment: "  Muy puntuales.  ");

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(5, result.Value!.Rating);
        Assert.Equal("Muy puntuales.", result.Value.Comment);
        Assert.NotEqual(default, result.Value.CreatedAt);

        var reviews = await ReviewsAsync(context, GroupId);
        Assert.Equal(5m, reviews.Summary.Average);
        Assert.Equal(1, reviews.Summary.Count);
        var item = Assert.Single(reviews.Items);
        Assert.Equal(5, item.Rating);
        Assert.Equal("Muy puntuales.", item.Comment);
        Assert.Equal("XV años", item.EventType);   // el tipo de evento del toque reseñado
        Assert.Equal("Ana L.", item.AuthorName);   // nombre e inicial del apellido
        Assert.DoesNotContain("@", item.AuthorName);
    }

    // ---------- Listado público ----------

    [Fact]
    public async Task ListadoPublico_OrdenaDeLaMasRecienteALaMasAntigua_YPagina()
    {
        await using var context = _fixture.CreateBookingsContext();
        var vieja = await SeedReviewableAsync(context);
        var media = await SeedReviewableAsync(context, clientId: OutsiderId);
        var nueva = await SeedReviewableAsync(context);
        await SeedReviewAsync(context, vieja.Id, rating: 5, createdAt: new DateTime(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc));
        await SeedReviewAsync(context, media.Id, clientId: OutsiderId, rating: 3, createdAt: new DateTime(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc));
        await SeedReviewAsync(context, nueva.Id, rating: 4, createdAt: new DateTime(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc));

        var primera = await ReviewsAsync(context, GroupId, page: 1, size: 2);

        Assert.Equal(3, primera.TotalCount);
        Assert.Equal(1, primera.PageNumber);
        Assert.Equal(2, primera.PageSize);
        Assert.True(primera.HasNextPage);
        Assert.False(primera.HasPreviousPage);
        Assert.Equal([4, 3], primera.Items.Select(i => i.Rating));
        Assert.Equal(["Ana L.", "Luis P."], primera.Items.Select(i => i.AuthorName));
        Assert.Equal(4.00m, primera.Summary.Average); // (5+3+4)/3 redondeado a dos decimales
        Assert.Equal(3, primera.Summary.Count);

        var segunda = await ReviewsAsync(context, GroupId, page: 2, size: 2);

        Assert.Equal(2, segunda.PageNumber);
        Assert.False(segunda.HasNextPage);
        Assert.True(segunda.HasPreviousPage);
        Assert.Equal(5, Assert.Single(segunda.Items).Rating);
    }

    [Fact]
    public async Task ListadoPublico_AcotaElTamanoDePagina_YNormalizaLaPagina()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context);
        await SeedReviewAsync(context, gig.Id);

        Assert.Equal(48, (await ReviewsAsync(context, GroupId, page: 1, size: 100)).PageSize);
        Assert.Equal(1, (await ReviewsAsync(context, GroupId, page: 1, size: 0)).PageSize);
        Assert.Equal(1, (await ReviewsAsync(context, GroupId, page: 0, size: 10)).PageNumber);
        Assert.Equal(1, (await ReviewsAsync(context, GroupId, page: -3, size: 10)).PageNumber);
    }

    [Fact]
    public async Task ListadoPublico_GrupoSinResenas_DevuelveResumenEnCeroYListaVacia()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedReviewableAsync(context);

        var reviews = await ReviewsAsync(context, GroupId);

        Assert.Equal(0m, reviews.Summary.Average);
        Assert.Equal(0, reviews.Summary.Count);
        Assert.Empty(reviews.Items);
        Assert.Equal(0, reviews.TotalCount);
        Assert.False(reviews.HasNextPage);
    }

    [Fact]
    public async Task ListadoPublico_SoloTraeLasResenasDeEseGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var propio = await SeedReviewableAsync(context);
        var ajeno = await SeedAsync(context, groupId: OtherGroupId, eventDate: Past,
            configure: request => request.Accept(null, Now.UtcDateTime));
        await SeedReviewAsync(context, propio.Id);
        await SeedReviewAsync(context, ajeno.Id, rating: 1, groupId: OtherGroupId);

        var reviews = await ReviewsAsync(context, GroupId);

        Assert.Equal(1, reviews.TotalCount);
        Assert.Equal(5, Assert.Single(reviews.Items).Rating);
    }
}
