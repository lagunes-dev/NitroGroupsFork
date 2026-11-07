using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Get;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.List;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

public class EventRequestQueryHandlersIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public EventRequestQueryHandlersIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Mias_SoloLasDelCliente_LasMasNuevasPrimero_ConResumenDelGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var vieja = await SeedAsync(context, createdAt: new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc));
        var nueva = await SeedAsync(context, groupId: OtherGroupId, createdAt: new DateTime(2026, 10, 5, 0, 0, 0, DateTimeKind.Utc));
        await SeedAsync(context, clientId: OutsiderId);

        var handler = new GetMyEventRequestsQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);
        var result = await handler.Handle(new GetMyEventRequestsQuery(ClientId), CancellationToken.None);

        Assert.Equal([nueva.Id, vieja.Id], result.Select(r => r.Id));
        Assert.Equal("Otro Grupo", result[0].GroupName);
        Assert.Equal("los-vargas", result[1].GroupSlug);
        Assert.All(result, r => Assert.Null(r.Messages));
    }

    [Fact]
    public async Task DelGrupo_SoloLasDeEseGrupo_ConNombreCortoDelCliente_YFiltroDeEstado()
    {
        await using var context = _fixture.CreateBookingsContext();
        var pendiente = await SeedAsync(context, createdAt: new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc));
        var aceptada = await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow), createdAt: new DateTime(2026, 10, 2, 0, 0, 0, DateTimeKind.Utc));
        await SeedAsync(context, groupId: OtherGroupId);

        var handler = new GetGroupEventRequestsQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);

        var todas = await handler.Handle(new GetGroupEventRequestsQuery(GroupId, null), CancellationToken.None);
        Assert.Equal([aceptada.Id, pendiente.Id], todas.Select(r => r.Id));
        Assert.All(todas, r => Assert.Equal("Ana L.", r.ClientName)); // nunca el apellido completo

        var pendientes = await handler.Handle(new GetGroupEventRequestsQuery(GroupId, EventRequestStatus.Pending), CancellationToken.None);
        Assert.Equal([pendiente.Id], pendientes.Select(r => r.Id));
    }

    // ---------- T29: el choque de fecha en la fila de la lista ----------

    private static readonly DateOnly ClashDay = new(2026, 12, 12);

    private GetGroupEventRequestsQueryHandler GroupListHandler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);

    private GetMyEventRequestsQueryHandler MyListHandler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);

    [Fact]
    public async Task BandejaDelGrupo_LaFilaAvisaDelChoqueConElToqueQueDeVerdadSePisa()
    {
        await using var context = _fixture.CreateBookingsContext();
        // El pedido es de 21:00 a 01:00; el toque de las 12:00 no se pisa y el de las 20:00 sí.
        var pedido = await SeedAsync(context, eventDate: ClashDay, startTime: new TimeOnly(21, 0));
        await SeedGigAsync(context, eventDate: ClashDay, startTime: new TimeOnly(12, 0));
        var boda = await SeedGigAsync(context, eventDate: ClashDay, startTime: new TimeOnly(20, 0));

        var rows = await GroupListHandler(context).Handle(new GetGroupEventRequestsQuery(GroupId, null), CancellationToken.None);

        var row = rows.Single(r => r.Id == pedido.Id);
        Assert.NotNull(row.DateClash);
        Assert.True(row.DateClash!.Clashes);
        Assert.Equal(boda.Id, row.DateClash.WithGig!.Id);
        Assert.Equal("20:00", row.DateClash.WithGig.StartTime);
        Assert.Equal(4, row.DateClash.WithGig.DurationHours);
        Assert.Equal("XV años", row.DateClash.WithGig.EventType);
    }

    [Fact]
    public async Task BandejaDelGrupo_SinHorasParaComparar_EligeElToqueMasTemprano()
    {
        await using var context = _fixture.CreateBookingsContext();
        var pedido = await SeedAsync(context, eventDate: ClashDay, startTime: null);
        await SeedGigAsync(context, eventDate: ClashDay, startTime: new TimeOnly(22, 0));
        var temprano = await SeedGigAsync(context, eventDate: ClashDay, startTime: new TimeOnly(9, 0));

        var rows = await GroupListHandler(context).Handle(new GetGroupEventRequestsQuery(GroupId, null), CancellationToken.None);

        var row = rows.Single(r => r.Id == pedido.Id);
        Assert.Equal(temprano.Id, row.DateClash!.WithGig!.Id);
    }

    [Fact]
    public async Task BandejaDelGrupo_SinToqueAceptadoEseDia_LaFilaNoAvisaChoque()
    {
        await using var context = _fixture.CreateBookingsContext();
        var pedido = await SeedAsync(context, eventDate: ClashDay, startTime: new TimeOnly(21, 0));
        await SeedGigAsync(context, eventDate: ClashDay.AddDays(7));                     // otro día
        await SeedGigAsync(context, groupId: OtherGroupId, eventDate: ClashDay);          // otro grupo
        await SeedAsync(context, eventDate: ClashDay, startTime: new TimeOnly(20, 0));    // sin aceptar

        var rows = await GroupListHandler(context).Handle(new GetGroupEventRequestsQuery(GroupId, null), CancellationToken.None);

        Assert.Null(rows.Single(r => r.Id == pedido.Id).DateClash);
    }

    [Fact]
    public async Task Mias_ElClienteNoVeSiElGrupoEstaOcupado()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedAsync(context, eventDate: ClashDay, startTime: new TimeOnly(21, 0));
        await SeedGigAsync(context, eventDate: ClashDay, startTime: new TimeOnly(20, 0));

        var rows = await MyListHandler(context).Handle(new GetMyEventRequestsQuery(ClientId), CancellationToken.None);

        Assert.NotEmpty(rows);
        Assert.All(rows, row => Assert.Null(row.DateClash));
    }

    // ---------- Ronda 10: el método de pago en la fila de la lista del cliente ----------

    private static readonly string GroupPaymentText =
        "Transfiere a la CLABE 0121 8000 1234 5678, BBVA, a nombre de Mónica Salinas.\n" +
        "Manda el comprobante al 33 1234 5678 con el concepto: boda 12 de diciembre.";

    [Fact]
    public async Task Mias_LaFilaDelClienteDiceElMetodoEnUnaSolaLinea()
    {
        await using var context = _fixture.CreateBookingsContext();
        var accepted = await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow));
        _scenario.SetPaymentInstructions(GroupId, GroupPaymentText);

        var rows = await MyListHandler(context).Handle(new GetMyEventRequestsQuery(ClientId), CancellationToken.None);

        var row = rows.Single(r => r.Id == accepted.Id);
        // La primera línea, no el párrafo: la fila es una fila.
        Assert.Equal("Transfiere a la CLABE 0121 8000 1234 5678, BBVA, a nombre de Mónica Salinas.", row.PaymentMethod);
    }

    [Fact]
    public async Task Mias_SinTextoDelGrupo_LaFilaNoDiceNadaDelMetodo()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow));

        var rows = await MyListHandler(context).Handle(new GetMyEventRequestsQuery(ClientId), CancellationToken.None);

        // El campo vacío no es un dato: no se inventa un método en la fila.
        Assert.Null(Assert.Single(rows).PaymentMethod);
    }

    [Fact]
    public async Task Mias_UnPedidoSinTratoCerrado_NoLlevaMetodo()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedAsync(context);
        _scenario.SetPaymentInstructions(GroupId, GroupPaymentText);

        var rows = await MyListHandler(context).Handle(new GetMyEventRequestsQuery(ClientId), CancellationToken.None);

        // Pendiente: todavía no hay pago, así que no hay cómo pagarlo.
        Assert.Null(Assert.Single(rows).PaymentMethod);
    }

    [Fact]
    public async Task Mias_ElMetodoLlegaConUnaSolaLecturaPorGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow));
        await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow));
        _scenario.SetPaymentInstructions(GroupId, GroupPaymentText);

        var rows = await MyListHandler(context).Handle(new GetMyEventRequestsQuery(ClientId), CancellationToken.None);

        Assert.All(rows, row => Assert.NotNull(row.PaymentMethod));
        // Una lectura por grupo distinto, nunca una por renglón: la lista no se vuelve N+1.
        await _scenario.Groups.Received(1).GetPaymentInstructionsAsync(GroupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BandejaDelGrupo_NoLlevaElMetodoDePago()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow));
        _scenario.SetPaymentInstructions(GroupId, GroupPaymentText);

        var rows = await GroupListHandler(context).Handle(new GetGroupEventRequestsQuery(GroupId, null), CancellationToken.None);

        // El grupo ya sabe cómo cobra: el campo es del cliente que paga.
        Assert.Null(Assert.Single(rows).PaymentMethod);
    }

    [Fact]
    public void LaLineaDelMetodo_EsLaPrimeraLineaConTexto()
    {
        // Línea en blanco primero: se salta lo vacío y se toma la primera con texto.
        var padded = "\n   \n  Transfiere a la CLABE 0121 8000 1234 5678, BBVA.  \nManda el comprobante al 33 1234 5678.\n";

        Assert.Equal("Transfiere a la CLABE 0121 8000 1234 5678, BBVA.", PaymentMethodLine.From(padded));
    }

    [Fact]
    public void LaLineaDelMetodo_RecortaElEspacioDeLosExtremos()
    {
        Assert.Equal("Efectivo en la oficina.", PaymentMethodLine.From("   Efectivo en la oficina.   "));
    }

    [Fact]
    public void LaLineaDelMetodo_NoEsUnParrafo()
    {
        var longLine = string.Join(' ', Enumerable.Repeat("transferencia", 40));

        var line = PaymentMethodLine.From(longLine);

        Assert.NotNull(line);
        Assert.True(line!.Length <= PaymentMethodLine.MaxLength + 1, $"midió {line.Length}");
        Assert.EndsWith("…", line);
        Assert.False(line.EndsWith(" …", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\n\n  \n")]
    public void LaLineaDelMetodo_SinTexto_EsNull(string? text)
    {
        Assert.Null(PaymentMethodLine.From(text));
    }

    [Theory]
    [InlineData(ClientId, false)]
    [InlineData(ManagerId, false)]
    [InlineData(null, true)] // admin aún sin sincronizar
    public async Task Detalle_ParticipantesOAdmin_VenLaSolicitudConMensajes(long? userId, bool isAdmin)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, configure: r =>
        {
            r.PostMessage(ClientId, EventRequestParty.Client, "Primero", new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc));
            r.PostMessage(ManagerId, EventRequestParty.Group, "Segundo", new DateTime(2026, 10, 2, 0, 0, 0, DateTimeKind.Utc));
        });

        var handler = new GetEventRequestByIdQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);
        var result = await handler.Handle(new GetEventRequestByIdQuery(request.Id, userId, isAdmin), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(["Primero", "Segundo"], result.Value!.Messages!.Select(m => m.Body));
        Assert.Equal(["Ana L.", "Los Vargas"], result.Value.Messages!.Select(m => m.SenderName));
    }

    [Theory]
    [InlineData(OutsiderId)]
    [InlineData(null)]
    public async Task Detalle_UnExtrano_RecibeNotFoundIgualQueSiNoExistiera(long? userId)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);
        var handler = new GetEventRequestByIdQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);

        var ajena = await handler.Handle(new GetEventRequestByIdQuery(request.Id, userId, false), CancellationToken.None);
        var inexistente = await handler.Handle(new GetEventRequestByIdQuery(request.Id + 1000, userId, false), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, ajena.ErrorKind);
        Assert.Equal(inexistente.ErrorKind, ajena.ErrorKind);
        Assert.Equal(inexistente.Error, ajena.Error);
    }
}
