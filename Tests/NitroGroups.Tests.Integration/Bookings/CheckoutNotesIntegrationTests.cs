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
/// el detalle del pedido; el texto vacío no dibuja la segunda nota pero la del acuerdo sigue estando;
/// la fecha del texto se dice cuando se puede leer y nunca se inventa.
/// </summary>
public class CheckoutNotesIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private const string GroupText = "Transfiere a la CLABE 0121 8000 1234 5678, BBVA, a nombre de Mónica Salinas.";
    private static readonly DateTime FiledAt = new(2026, 11, 5, 18, 0, 0, DateTimeKind.Utc); // 12:00 en CDMX

    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public CheckoutNotesIntegrationTests(IntegrationTestFixture fixture) => _fixture = fixture;

    // ---------------------------------------------------------------------
    // El cliente de un evento aceptado lee las dos notas, en orden
    // ---------------------------------------------------------------------

    [Fact]
    public async Task ClienteDeUnEventoAceptado_LeeLaNotaDelAcuerdoYLaDelGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        _scenario.SetPaymentInstructions(GroupId, GroupText, FiledAt);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(2, result.Value!.Count);

        var acuerdo = result.Value[0];
        Assert.Equal("Cómo pagar", acuerdo.Title);
        // El nombre del manager sale de Users; el cliente trata con el grupo, no con una bandeja.
        Assert.Equal("Acordaste el pago en efectivo con el grupo. Te atiende Pedro Vargas.", acuerdo.Body);
        Assert.Equal("Pagas directo al grupo; NitroGroups no cobra ni interviene.", acuerdo.UserDescription);
        Assert.Null(acuerdo.UpdatedOn);

        var delGrupo = result.Value[1];
        Assert.Equal("Instrucciones del grupo", delGrupo.Title);
        // El texto del grupo se repite tal cual: la app no lo reescribe ni lo resume.
        Assert.Equal(GroupText, delGrupo.Body);
        Assert.Equal("Pagas directo al grupo; NitroGroups no cobra ni interviene.", delGrupo.UserDescription);
        Assert.Equal(new DateOnly(2026, 11, 5), delGrupo.UpdatedOn);
    }

    [Fact]
    public async Task SinTextoDelGrupo_SoloQuedaLaNotaDelAcuerdo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);
        var note = Assert.Single(result.Value!);
        Assert.Equal("Cómo pagar", note.Title);
        Assert.Equal("Acordaste el pago en efectivo con el grupo. Te atiende Pedro Vargas.", note.Body);
        Assert.Equal("Pagas directo al grupo; NitroGroups no cobra ni interviene.", note.UserDescription);
    }

    [Fact]
    public async Task SinNombreDelManager_LaFraseQuedaSinNombreYNoLlevaCorreo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        _scenario.AllUsers.Remove(ManagerId);
        _scenario.SetPaymentInstructions(GroupId, GroupText, FiledAt);

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal("Acordaste el pago en efectivo con el grupo.", result.Value![0].Body);
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
        var delGrupo = result.Value![1];
        Assert.Equal(GroupText, delGrupo.Body);
        // Un texto sin fecha legible se lee sin fecha: nunca una fecha inventada.
        Assert.Null(delGrupo.UpdatedOn);
    }

    [Fact]
    public async Task LaFechaEsElDiaEnMexico_NoElDiaUtc()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAcceptedAsync(context);
        // 6 de noviembre a las 03:00 UTC es la noche del 5 en la Ciudad de México.
        _scenario.SetPaymentInstructions(GroupId, GroupText, new DateTime(2026, 11, 6, 3, 0, 0, DateTimeKind.Utc));

        var result = await HandleAsync(context, request.Id, ClientId);

        Assert.Equal(new DateOnly(2026, 11, 5), result.Value![1].UpdatedOn);
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
