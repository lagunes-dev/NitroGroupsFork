using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Cancel;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Create;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Messages;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Respond;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Bookings;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

public class EventRequestCommandHandlersIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public EventRequestCommandHandlersIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    private CreateEventRequestCommandHandler CreateHandler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context, _fixture.CreateBookingsOutbox(context)),
            _scenario.Groups, _scenario.Users, _scenario.Schedules, _scenario.Time);

    private RespondToEventRequestCommandHandler RespondHandler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context, _fixture.CreateBookingsOutbox(context)),
            _scenario.Groups, _scenario.Users, _scenario.Time);

    private CancelEventRequestCommandHandler CancelHandler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context, _fixture.CreateBookingsOutbox(context)),
            _scenario.Groups, _scenario.Users, _scenario.Time);

    private PostEventRequestMessageCommandHandler MessageHandler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context, _fixture.CreateBookingsOutbox(context)),
            _scenario.Groups, _scenario.Users, _scenario.Time);

    // ---------- Crear ----------

    [Fact]
    public async Task Crear_CasoFeliz_GuardaPendienteYDevuelveElResumenDelGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var saved = Assert.Single(context.EventRequests);
        Assert.Equal(ClientId, saved.ClientUserId);
        Assert.Equal(GroupId, saved.GroupId);
        Assert.Equal(EventRequestStatus.Pending, saved.Status);
        Assert.Equal("MXN", saved.Currency);
        Assert.Equal(saved.Id, result.Value!.Id);
        Assert.Equal("Los Vargas", result.Value.GroupName);
        Assert.Equal("los-vargas", result.Value.GroupSlug);
        Assert.Equal("Ana L.", result.Value.ClientName);
    }

    [Fact]
    public async Task Crear_ConsultaLaDisponibilidadDelDiaEnHoraDeMexico()
    {
        await using var context = _fixture.CreateBookingsContext();

        await CreateHandler(context).Handle(CreateCommand(new DateOnly(2026, 12, 12)), CancellationToken.None);

        await _scenario.Schedules.Received(1).GetUnavailableGroupIdsAsync(
            Arg.Is<IReadOnlyCollection<long>>(ids => ids.Single() == GroupId),
            new DateTimeOffset(2026, 12, 12, 0, 0, 0, TimeSpan.FromHours(-6)),
            new DateTimeOffset(2026, 12, 13, 0, 0, 0, TimeSpan.FromHours(-6)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Crear_GrupoQueNoAceptaReservas_FallaYNoGuarda()
    {
        _scenario.Groups.GetGroupAsync(GroupId, Arg.Any<CancellationToken>()).Returns(Vargas with { IsAcceptingBookings = false });
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Este grupo no está recibiendo solicitudes por ahora.", result.Error);
        Assert.Empty(context.EventRequests);
    }

    [Fact]
    public async Task Crear_GrupoInactivo_FallaYNoGuarda()
    {
        // Aunque "acepte reservas", un grupo inactivo no opera: gana el estado más restrictivo.
        _scenario.Groups.GetGroupAsync(GroupId, Arg.Any<CancellationToken>()).Returns(Vargas with { IsActive = false });
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Este grupo no está activo en la plataforma.", result.Error);
        Assert.Empty(context.EventRequests);
    }

    [Fact]
    public async Task Crear_PorUnManagerDelGrupo_SeMarcaComoAutosolicitud()
    {
        _scenario.Groups.CanManageGroupAsync(GroupId, ClientId, Arg.Any<CancellationToken>()).Returns(true);
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(Assert.Single(context.EventRequests).IsSelfBooked);
    }

    [Fact]
    public async Task Crear_PorUnCliente_NoEsAutosolicitud()
    {
        await using var context = _fixture.CreateBookingsContext();

        await CreateHandler(context).Handle(CreateCommand(), CancellationToken.None);

        Assert.False(Assert.Single(context.EventRequests).IsSelfBooked);
    }

    [Fact]
    public async Task Crear_GrupoInexistente_DevuelveNotFound()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(groupId: 777), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Empty(context.EventRequests);
    }

    [Fact]
    public async Task Crear_FechaNoDisponible_FallaYNoGuarda()
    {
        _scenario.Schedules.GetUnavailableGroupIdsAsync(Arg.Any<IReadOnlyCollection<long>>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<long> { GroupId });
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("El grupo no está disponible en esa fecha.", result.Error);
        Assert.Empty(context.EventRequests);
    }

    [Fact]
    public async Task Crear_FechaPasada_FallaYNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(new DateOnly(2026, 11, 2)), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("La fecha del evento no puede ser anterior a hoy.", result.Error);
        Assert.Empty(context.EventRequests);
    }

    [Fact]
    public async Task Crear_HoyEnMexicoAunqueEnUtcYaSeaManana_SeAcepta()
    {
        // 03:00 UTC del 4/11 = 21:00 del 3/11 en CDMX: "hoy" sigue siendo el 3.
        _scenario.Time = new FixedTimeProvider(new DateTimeOffset(2026, 11, 4, 3, 0, 0, TimeSpan.Zero));
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(new DateOnly(2026, 11, 3)), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
    }

    [Fact]
    public async Task Crear_GuardaElEventoCreadoEnElOutbox()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await CreateHandler(context).Handle(CreateCommand(), CancellationToken.None);

        var outbox = Assert.Single(context.OutboxEvents);
        Assert.Equal(nameof(EventRequestCreatedEvent), outbox.EventType);
        Assert.Contains($"\"EventRequestId\":{result.Value!.Id}", outbox.EventData);
        Assert.Contains($"\"GroupId\":{GroupId}", outbox.EventData);
        Assert.False(outbox.Processed);
    }

    // ---------- Aceptar / rechazar ----------

    [Theory]
    [InlineData(EventRequestDecision.Accept, EventRequestStatus.Accepted)]
    [InlineData(EventRequestDecision.Decline, EventRequestStatus.Declined)]
    public async Task Responder_ManagerDelGrupo_CambiaElEstadoYGuardaElEventoEnElOutbox(EventRequestDecision decision, EventRequestStatus expected)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await RespondHandler(context).Handle(
            new RespondToEventRequestCommand(request.Id, ManagerId, decision, "  Con gusto  "), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        context.ChangeTracker.Clear();
        var saved = await context.EventRequests.SingleAsync();
        Assert.Equal(expected, saved.Status);
        Assert.Equal("Con gusto", saved.ResponseMessage);
        Assert.Equal(Now.UtcDateTime, saved.RespondedAt);

        var outbox = Assert.Single(context.OutboxEvents);
        Assert.Equal(nameof(EventRequestStatusChangedEvent), outbox.EventType);
        Assert.Contains($"\"NewStatus\":{(int)expected}", outbox.EventData);
    }

    [Fact]
    public async Task Responder_UsuarioQueNoEsManager_DevuelveNotFoundYNoCambiaNada()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await RespondHandler(context).Handle(
            new RespondToEventRequestCommand(request.Id, OutsiderId, EventRequestDecision.Accept, null), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        context.ChangeTracker.Clear();
        Assert.Equal(EventRequestStatus.Pending, (await context.EventRequests.SingleAsync()).Status);
        Assert.Empty(context.OutboxEvents);
    }

    [Fact]
    public async Task Responder_ElClienteNoPuedeAceptarSuPropiaSolicitud_Forbidden()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await RespondHandler(context).Handle(
            new RespondToEventRequestCommand(request.Id, ClientId, EventRequestDecision.Accept, null), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Forbidden, result.ErrorKind);
    }

    [Fact]
    public async Task Responder_ManagerDeOtroGrupo_NoPuedeAceptarSolicitudesAjenas()
    {
        // IDOR: el usuario 100 administra el grupo 10, pero la solicitud es del grupo 20.
        await using var context = _fixture.CreateBookingsContext();
        var ajena = await SeedAsync(context, groupId: OtherGroupId);

        var result = await RespondHandler(context).Handle(
            new RespondToEventRequestCommand(ajena.Id, ManagerId, EventRequestDecision.Accept, null), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        await _scenario.Groups.Received().CanManageGroupAsync(OtherGroupId, ManagerId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Responder_SolicitudYaCancelada_DevuelveConflict()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, configure: r => r.Cancel(EventRequestParty.Client));

        var result = await RespondHandler(context).Handle(
            new RespondToEventRequestCommand(request.Id, ManagerId, EventRequestDecision.Accept, null), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Solo se puede aceptar una solicitud pendiente; esta está cancelada.", result.Error);
        Assert.Empty(context.OutboxEvents);
    }

    [Fact]
    public async Task Responder_SolicitudInexistente_DevuelveNotFound()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await RespondHandler(context).Handle(
            new RespondToEventRequestCommand(12345, ManagerId, EventRequestDecision.Decline, null), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
    }

    // ---------- Cancelar ----------

    [Fact]
    public async Task Cancelar_ElClientePuedeCancelarSuSolicitudPendiente()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, ClientId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        context.ChangeTracker.Clear();
        Assert.Equal(EventRequestStatus.Cancelled, (await context.EventRequests.SingleAsync()).Status);
        var outbox = Assert.Single(context.OutboxEvents);
        Assert.Equal(nameof(EventRequestStatusChangedEvent), outbox.EventType);
        Assert.Contains($"\"ChangedBy\":{(int)EventRequestParty.Client}", outbox.EventData);
    }

    [Fact]
    public async Task Cancelar_ElGrupoNoPuedeCancelarUnaPendiente_Conflict()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, ManagerId), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("El grupo no puede cancelar una solicitud pendiente; puede rechazarla.", result.Error);
    }

    [Fact]
    public async Task Cancelar_ElGrupoPuedeCancelarUnaAceptada()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow));

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, ManagerId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(EventRequestStatus.Cancelled, result.Value!.Status);
    }

    [Fact]
    public async Task Cancelar_UnaRechazada_Conflict()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, configure: r => r.Decline(null, DateTime.UtcNow));

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, ClientId), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
    }

    [Fact]
    public async Task Cancelar_UnExtrano_DevuelveNotFound()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, OutsiderId), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        context.ChangeTracker.Clear();
        Assert.Equal(EventRequestStatus.Pending, (await context.EventRequests.SingleAsync()).Status);
    }

    /// <summary>
    /// S8/T52: un evento aceptado cuya fecha ya pasó ya se tocó: cancelarlo no deshace nada y el hilo del
    /// cliente dejó de ofrecer el botón. La API lo rechaza con el mismo día de México que los avisos.
    /// </summary>
    [Theory]
    [InlineData(ClientId)]
    [InlineData(ManagerId)]
    public async Task Cancelar_UnaAceptadaConFechaPasada_ConflictYNoEscribeNada(long userId)
    {
        await using var context = _fixture.CreateBookingsContext();
        // El reloj del escenario es el 3/11/2026 al mediodía en México.
        var request = await SeedAsync(
            context,
            eventDate: new DateOnly(2026, 10, 24),
            configure: r => r.Accept(null, DateTime.UtcNow));

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, userId), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("No puedes cancelar un evento que ya pasó.", result.Error);
        Assert.Null(result.Value);
        context.ChangeTracker.Clear();
        var saved = await context.EventRequests.SingleAsync();
        Assert.Equal(EventRequestStatus.Accepted, saved.Status);
        Assert.NotNull(saved.RespondedAt); // sigue aceptado, con la respuesta original intacta
        Assert.Empty(context.OutboxEvents);
    }

    /// <summary>El día de hoy en México todavía se cancela: la fecha que pasó es la de ayer, no la de hoy.</summary>
    [Theory]
    [InlineData(2026, 11, 3)] // hoy en México, según el reloj fijo del escenario
    [InlineData(2026, 12, 12)] // la fecha futura de siempre
    public async Task Cancelar_UnaAceptadaDeHoyOFutura_SeSigueCancelandoIgual(int year, int month, int day)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(
            context,
            eventDate: new DateOnly(year, month, day),
            configure: r => r.Accept(null, DateTime.UtcNow));

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, ClientId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(EventRequestStatus.Cancelled, result.Value!.Status);
        context.ChangeTracker.Clear();
        Assert.Equal(EventRequestStatus.Cancelled, (await context.EventRequests.SingleAsync()).Status);
        Assert.Single(context.OutboxEvents);
    }

    /// <summary>La regla es solo para aceptadas: una solicitud pendiente vieja todavía se puede cerrar.</summary>
    [Fact]
    public async Task Cancelar_UnaPendienteConFechaPasada_SeSigueCancelando()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, eventDate: new DateOnly(2026, 10, 24));

        var result = await CancelHandler(context).Handle(new CancelEventRequestCommand(request.Id, ClientId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(EventRequestStatus.Cancelled, result.Value!.Status);
    }

    // ---------- Mensajes ----------

    [Theory]
    [InlineData(ClientId, EventRequestParty.Client, "Ana L.")]
    [InlineData(ManagerId, EventRequestParty.Group, "Los Vargas")]
    public async Task Mensaje_UnParticipante_LoGuardaYAvisaPorOutbox(long senderId, EventRequestParty party, string senderName)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await MessageHandler(context).Handle(
            new PostEventRequestMessageCommand(request.Id, senderId, "  ¿Incluye sonido?  "), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(party, result.Value!.SenderParty);
        Assert.Equal(senderName, result.Value.SenderName);
        var saved = Assert.Single(context.EventRequestMessages);
        Assert.Equal("¿Incluye sonido?", saved.Body);
        Assert.Equal(senderId, saved.SenderUserId);
        Assert.Equal(request.Id, saved.EventRequestId);

        var outbox = Assert.Single(context.OutboxEvents);
        Assert.Equal(nameof(EventRequestMessagePostedEvent), outbox.EventType);
        Assert.DoesNotContain("Incluye sonido", outbox.EventData); // el texto no viaja en el evento
    }

    [Fact]
    public async Task Mensaje_UnExtrano_DevuelveNotFoundYNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context);

        var result = await MessageHandler(context).Handle(
            new PostEventRequestMessageCommand(request.Id, OutsiderId, "Hola, ¿siguen libres?"), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Empty(context.EventRequestMessages);
        Assert.Empty(context.OutboxEvents);
    }

    [Theory]
    [InlineData("rechazada")]
    [InlineData("cancelada")]
    public async Task Mensaje_EnSolicitudCerrada_ConflictYNoGuarda(string estado)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, configure: r =>
        {
            if (estado == "rechazada") r.Decline(null, DateTime.UtcNow);
            else r.Cancel(EventRequestParty.Client);
        });

        var result = await MessageHandler(context).Handle(
            new PostEventRequestMessageCommand(request.Id, ClientId, "¿Y si lo movemos al sábado?"), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Contains("nueva solicitud", result.Error);
        Assert.Empty(context.EventRequestMessages);
        Assert.Empty(context.OutboxEvents);
    }

    [Fact]
    public async Task Mensaje_EnSolicitudAceptada_SePermite()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, configure: r => r.Accept(null, DateTime.UtcNow));

        var result = await MessageHandler(context).Handle(
            new PostEventRequestMessageCommand(request.Id, ClientId, "¿A qué hora llegan a montar?"), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
    }
}
