using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.CheckoutNotes;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// Ronda 9, "cómo pagar": la cuarta cosa que le faltaba al cliente. Veía cuánto debía y para cuándo,
/// pero no cómo pagar. La app no cobra ni mueve dinero (D1/S18): la nota solo repite cómo dijo el
/// grupo que quiere que se le pague.
/// Reglas: solo el cliente del pedido, solo si está aceptado, cualquier otro caso es el mismo 404 que
/// el detalle del pedido; **una sola nota autoritativa** (ronda 10): si el grupo escribió, su texto es
/// el único método que se enuncia y el nombre del manager va aparte; si no escribió, la nota dice con
/// quién se acuerda y no inventa un método; la app nunca dice "efectivo" con su propia voz; la fecha
/// del texto se dice cuando se puede leer y nunca se inventa.
/// </summary>
public class CheckoutNotesIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private const string GroupText = "Transfiere a la CLABE 0121 8000 1234 5678, BBVA, a nombre de Mónica Salinas.";
    private static readonly DateTime FiledAt = new(2026, 11, 5, 18, 0, 0, DateTimeKind.Utc); // 12:00 en CDMX

    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public CheckoutNotesIntegrationTests(IntegrationTestFixture fixture) => _fixture = fixture;

    // ---------------------------------------------------------------------
    // Ronda 10: una sola nota autoritativa, nunca dos que se contradicen
    // ---------------------------------------------------------------------

    [Fact]
    public async Task ConTextoDelGrupo_ElTextoEsElUnicoMetodoYElManagerVaAparte()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        _scenario.SetPaymentInstructions(GroupId, GroupText, FiledAt);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);

        // Una sola nota: una app que enuncia un acuerdo y luego instrucciones que lo contradicen deja
        // al cliente sin saber con qué quedarse (ronda 10).
        var note = Assert.Single(result.Value!);
        Assert.Equal("Cómo pagar", note.Title);
        // El texto del grupo se repite tal cual: la app no lo reescribe ni lo resume.
        Assert.Equal(GroupText, note.Body);
        // El nombre del manager sale de Users y va en su propia línea, en voz de la app.
        Assert.Equal("Te atiende Pedro Vargas.", note.ManagerLine);
        Assert.Equal("Pagas directo al grupo; NitroGroups no cobra ni interviene.", note.UserDescription);
        Assert.Equal(new DateOnly(2026, 11, 5), note.UpdatedOn);
    }

    [Fact]
    public async Task SinTextoDelGrupo_LaNotaNoInventaUnMetodo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);
        var note = Assert.Single(result.Value!);
        Assert.Equal("Cómo pagar", note.Title);
        // Ni efectivo ni transferencia: el método lo acuerda el cliente con el grupo.
        Assert.Equal("Acuerdas el pago con el grupo.", note.Body);
        Assert.Equal("Te atiende Pedro Vargas.", note.ManagerLine);
        Assert.Equal("Pagas directo al grupo; NitroGroups no cobra ni interviene.", note.UserDescription);
        Assert.Null(note.UpdatedOn);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task LaAppNuncaDiceEfectivoConSuPropiaVoz(bool groupWrote)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        if (groupWrote)
            _scenario.SetPaymentInstructions(GroupId, GroupText, FiledAt);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);
        // El texto del grupo puede hablar de efectivo; la voz de la app no afirma ningún método.
        Assert.DoesNotContain(result.Value!, note =>
            note.Body.Contains("efectivo", StringComparison.OrdinalIgnoreCase)
            || (note.ManagerLine?.Contains("efectivo", StringComparison.OrdinalIgnoreCase) ?? false)
            || note.UserDescription.Contains("efectivo", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task SinNombreDelManager_LaNotaQuedaSinEsaLineaYNoLlevaCorreo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        _scenario.AllUsers.Remove(ManagerId);
        _scenario.SetPaymentInstructions(GroupId, GroupText, FiledAt);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Null(result.Value![0].ManagerLine);
        Assert.DoesNotContain(result.Value!, note => note.Body.Contains('@') || note.Title.Contains('@'));
    }

    [Fact]
    public async Task SinFechaDelTexto_LaNotaNoInventaLaFecha()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        _scenario.SetPaymentInstructions(GroupId, GroupText, updatedAt: null);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);
        var note = result.Value![0];
        Assert.Equal(GroupText, note.Body);
        // Un texto sin fecha legible se lee sin fecha: nunca una fecha inventada.
        Assert.Null(note.UpdatedOn);
    }

    [Fact]
    public async Task LaFechaEsElDiaEnMexico_NoElDiaUtc()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        // 6 de noviembre a las 03:00 UTC es la noche del 5 en la Ciudad de México.
        _scenario.SetPaymentInstructions(GroupId, GroupText, new DateTime(2026, 11, 6, 3, 0, 0, DateTimeKind.Utc));

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.Equal(new DateOnly(2026, 11, 5), result.Value![0].UpdatedOn);
    }

    // ---------------------------------------------------------------------
    // Quién no lo lee: el mismo 404 que un pedido que no puede leer
    // ---------------------------------------------------------------------

    [Fact]
    public async Task PedidoPendiente_NoSeLee()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, clientId: ClientId);
        _scenario.SetPaymentInstructions(GroupId, GroupText, FiledAt);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Solicitud no encontrada.", result.Error);
        Assert.Null(result.Value);
    }

    [Fact]
    public async Task PedidoRechazado_NoSeLee()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, clientId: ClientId, configure: r => r.Decline(null, DateTime.UtcNow));

        Assert.Equal(BookingErrorKind.NotFound, (await HandleAsync(context, request.Id, ClientId)).ErrorKind);
    }

    [Fact]
    public async Task PedidoCancelado_NoSeLee()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, clientId: ClientId, configure: r =>
        {
            r.Accept(null, DateTime.UtcNow);
            r.Cancel(EventRequestParty.Client);
        });

        Assert.Equal(BookingErrorKind.NotFound, (await HandleAsync(context, request.Id, ClientId)).ErrorKind);
    }

    [Fact]
    public async Task OtroCliente_NoSeLee()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        _scenario.SetPaymentInstructions(GroupId, GroupText, FiledAt);

        var result = await HandleAsync(context, request.Id, OutsiderId);

        // Ni siquiera se revela que el pedido existe (mismo criterio que GET api/event-requests/{id}).
        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Null(result.Value);
    }

    [Fact]
    public async Task ElManagerDelGrupo_NoSeLeeComoCliente()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);

        // El manager participa del pedido, pero estas notas son del cliente: cómo pagar es para quien paga.
        Assert.Equal(BookingErrorKind.NotFound, (await HandleAsync(context, request.Id, ManagerId)).ErrorKind);
    }

    [Fact]
    public async Task SinUsuario_NoSeLee()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);

        Assert.Equal(BookingErrorKind.NotFound, (await HandleAsync(context, request.Id, userId: null)).ErrorKind);
    }

    [Fact]
    public async Task PedidoInexistente_NoSeLee()
    {
        await using var context = _fixture.CreateBookingsContext();

        Assert.Equal(BookingErrorKind.NotFound, (await HandleAsync(context, requestId: 9_999, ClientId)).ErrorKind);
    }

    // ---------------------------------------------------------------------
    // Andamiaje
    // ---------------------------------------------------------------------

    private Task<BookingResult<List<CheckoutNoteResponse>>> HandleAsync(
        BookingsDbContext context,
        long requestId,
        long? userId)
        => new GetEventRequestCheckoutNotesQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users)
            .Handle(new GetEventRequestCheckoutNotesQuery(requestId, userId), CancellationToken.None);

    private static Task<EventRequest> SeedAcceptedAsync(BookingsDbContext context)
        => SeedAsync(context, clientId: ClientId, configure: r => r.Accept(null, DateTime.UtcNow));
}
