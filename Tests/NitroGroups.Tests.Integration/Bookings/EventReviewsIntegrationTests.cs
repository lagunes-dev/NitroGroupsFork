using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Get;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.List;
using NitroGroups.Core.Bookings.Application.UseCases.Reviews;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// S5 (D7): solo escribe una reseña el cliente de un evento aceptado cuya fecha ya pasó, una por
/// evento. Hoy es 3/11/2026 en México, así que el 20/10/2026 ya pasó y el 12/12/2026 no.
/// </summary>
public class EventReviewsIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private static readonly DateOnly Past = new(2026, 10, 20);

    private readonly IntegrationTestFixture _fixture = fixture;
    private readonly BookingsTestScenario _scenario = new();

    private Task<BookingResult<EventReviewResponse>> ReviewAsync(
        BookingsDbContext context,
        long eventId,
        long clientId = ClientId,
        int? rating = 5,
        string? comment = null)
        => new PostEventReviewCommandHandler(
                _fixture.CreateBookingsUnitOfWork(context, _fixture.CreateBookingsOutbox(context)), _scenario.Time)
            .Handle(new PostEventReviewCommand(eventId, clientId, rating, comment), CancellationToken.None);

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

    // ---------- Escribir ----------

    [Fact]
    public async Task Resena_GuardaElEventoParaQueGroupsActualiceElAgregado()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context);

        await ReviewAsync(context, gig.Id, rating: 4, comment: "Bien");

        var outbox = Assert.Single(context.OutboxEvents);
        Assert.False(outbox.Processed);
        Assert.Equal("GroupReviewPostedEvent", outbox.EventType);
        Assert.Contains($"\"GroupId\":{GroupId}", outbox.EventData);
        Assert.Contains("\"Rating\":4", outbox.EventData);
    }

    [Fact]
    public async Task Resena_EventoFuturoAceptado_Returns409YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context); // fecha futura (12/12/2026), aceptado

        var result = await ReviewAsync(context, gig.Id);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Todavía no puedes reseñar este evento: la fecha aún no ha pasado.", result.Error);
        Assert.Empty(context.EventReviews.ToList());
    }

    [Fact]
    public async Task Resena_EventoDeHoy_Returns409PorqueLaFechaTodaviaNoHaPasado()
    {
        await using var context = _fixture.CreateBookingsContext();
        var hoy = await SeedAsync(context, eventDate: new DateOnly(2026, 11, 3),
            configure: request => request.Accept(null, Now.UtcDateTime));

        var result = await ReviewAsync(context, hoy.Id);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Todavía no puedes reseñar este evento: la fecha aún no ha pasado.", result.Error);
        Assert.Equal(EventRequestStatus.Accepted, context.EventRequests.Single(r => r.Id == hoy.Id).Status);
        Assert.Empty(context.EventReviews.ToList());
    }

    [Fact]
    public async Task Resena_EventoPendienteRechazadoOCancelado_Returns409YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var pendiente = await SeedAsync(context, eventDate: Past);
        var rechazado = await SeedAsync(context, eventDate: Past,
            configure: request => request.Decline("No podemos", Now.UtcDateTime));
        var cancelado = await SeedReviewableAsync(context);
        cancelado.Cancel(EventRequestParty.Client);
        await context.SaveChangesAsync();

        foreach (var eventId in new[] { pendiente.Id, rechazado.Id, cancelado.Id })
        {
            var result = await ReviewAsync(context, eventId);
            Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
            Assert.Equal("Todavía no puedes reseñar este evento: el grupo aún no lo ha aceptado.", result.Error);
        }

        Assert.Empty(context.EventReviews.ToList());
    }

    [Fact]
    public async Task Resena_Autorreserva_Returns409YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var propia = await SeedReviewableAsync(context, selfBooked: true);

        var result = await ReviewAsync(context, propia.Id);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("No puedes reseñar un evento que reservó el propio grupo.", result.Error);
        Assert.Empty(context.EventReviews.ToList());
    }

    [Fact]
    public async Task Resena_SegundaVez_Returns409YQuedaUnaSola()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context);
        await ReviewAsync(context, gig.Id, rating: 5, comment: "Primera");

        var result = await ReviewAsync(context, gig.Id, rating: 1, comment: "Segunda");

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Ya escribiste una reseña para este evento.", result.Error);
        var saved = Assert.Single(context.EventReviews.ToList());
        Assert.Equal(5, saved.Rating);
        Assert.Equal("Primera", saved.Comment);
    }

    [Fact]
    public async Task Resena_EventoDeOtroCliente_Returns404YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context); // la clienta es Ana (200)

        var result = await ReviewAsync(context, gig.Id, clientId: OutsiderId);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Solicitud no encontrada.", result.Error);
        Assert.Empty(context.EventReviews.ToList());
    }

    [Fact]
    public async Task Resena_EventoInexistente_Returns404()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await ReviewAsync(context, 4040);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Solicitud no encontrada.", result.Error);
    }

    [Theory]
    [InlineData(0, null)]
    [InlineData(6, null)]
    [InlineData(null, null)]
    [InlineData(5, 1001)]
    public async Task Resena_CalificacionFueraDeRangoOComentarioLargo_Returns400YNoGuarda(int? rating, int? commentLength)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context);
        var comment = commentLength is { } length ? new string('x', length) : null;

        var result = await ReviewAsync(context, gig.Id, rating: rating, comment: comment);

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal(
            commentLength is null ? "La calificación debe estar entre 1 y 5." : "El comentario no puede pasar de 1000 caracteres.",
            result.Error);
        Assert.Empty(context.EventReviews.ToList());
    }

    [Fact]
    public async Task Resena_ComentarioVacioSeGuardaComoNulo_Y1000CaracteresSeAceptan()
    {
        await using var context = _fixture.CreateBookingsContext();
        var sinComentario = await SeedReviewableAsync(context);
        var largo = await SeedReviewableAsync(context);

        var vacio = await ReviewAsync(context, sinComentario.Id, comment: "   ");
        var justo = await ReviewAsync(context, largo.Id, comment: new string('x', 1000));

        Assert.True(vacio.IsSuccess, vacio.Error);
        Assert.Null(vacio.Value!.Comment);
        Assert.True(justo.IsSuccess, justo.Error);
        Assert.Equal(1000, justo.Value!.Comment!.Length);
    }

    // ---------- canReview / review en las solicitudes del cliente ----------

    [Fact]
    public async Task MisSolicitudes_ElClientePuedeResenarSoloSuEventoPasadoAceptado_YDespuesVeLaResena()
    {
        await using var context = _fixture.CreateBookingsContext();
        var pasado = await SeedReviewableAsync(context);
        await SeedGigAsync(context);                                   // futuro: todavía no
        await SeedAsync(context);                                      // pendiente
        await SeedReviewableAsync(context, selfBooked: true);          // autorreserva: nunca

        var antes = await MineAsync(context);
        Assert.True(antes.Single(r => r.Id == pasado.Id).CanReview);
        Assert.Single(antes.Where(r => r.CanReview)); // solo ese: futuro, pendiente y autorreserva no
        Assert.All(antes, r => Assert.Null(r.Review));

        await ReviewAsync(context, pasado.Id, rating: 4, comment: "Muy bien");

        var despues = await MineAsync(context);
        var revisada = despues.Single(r => r.Id == pasado.Id);
        Assert.False(revisada.CanReview);
        Assert.Equal(4, revisada.Review!.Rating);
        Assert.Equal("Muy bien", revisada.Review.Comment);
    }

    [Fact]
    public async Task DetalleDeLaSolicitud_ElGrupoVeLaResenaPeroNoPuedeResenar()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context);
        await ReviewAsync(context, gig.Id, rating: 5, comment: "Excelentes");

        var result = await new GetEventRequestByIdQueryHandler(
                _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetEventRequestByIdQuery(gig.Id, ManagerId, false), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.False(result.Value!.CanReview);            // el manager no escribe reseñas
        Assert.Equal(5, result.Value.Review!.Rating);     // pero ve la del cliente
        Assert.Equal("Excelentes", result.Value.Review.Comment);
    }

    [Fact]
    public async Task BandejaDelGrupo_NuncaOfreceResenar_YMuestraLaQueYaExiste()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedReviewableAsync(context);
        await ReviewAsync(context, gig.Id, rating: 3);

        var rows = await new GetGroupEventRequestsQueryHandler(
                _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetGroupEventRequestsQuery(GroupId, null), CancellationToken.None);

        var row = Assert.Single(rows);
        Assert.False(row.CanReview);
        Assert.Equal(3, row.Review!.Rating);
    }

    private Task<List<EventRequestResponse>> MineAsync(BookingsDbContext context)
        => new GetMyEventRequestsQueryHandler(
                _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetMyEventRequestsQuery(ClientId), CancellationToken.None);
}
