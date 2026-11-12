using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Get;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Details;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Pay;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// S3 y S4: setlist, hora de llamado y anticipo del toque, y lo que se le paga a cada músico.
/// El pago es informativo: nunca se suma ni se compara con el presupuesto.
/// </summary>
public class GigLogisticsHandlersIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public GigLogisticsHandlersIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
        _scenario.Groups.GetActiveMemberUserIdsAsync(GroupId, Arg.Any<CancellationToken>())
            .Returns([ManagerId, MemberId, OtherMemberId]);
    }

    private Task<BookingResult<GroupGigResponse>> DetailsAsync(BookingsDbContext context, long gigId, UpdateGigDetailsBody body, long groupId = GroupId)
        => new UpdateGigDetailsCommandHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new UpdateGigDetailsCommand(groupId, gigId, ManagerId, body), CancellationToken.None);

    private Task<BookingResult<GroupGigResponse>> PayAsync(BookingsDbContext context, long gigId, params (long UserId, decimal Amount)[] payments)
        => PayBodyAsync(context, gigId, new SetGigPayBody { Payments = payments.Select(p => new GigPayItemBody { UserId = p.UserId, Amount = p.Amount }).ToList() });

    private Task<BookingResult<GroupGigResponse>> PayBodyAsync(BookingsDbContext context, long gigId, SetGigPayBody body, long groupId = GroupId)
        => new SetGigPayCommandHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new SetGigPayCommand(groupId, gigId, ManagerId, body), CancellationToken.None);

    private Task<BookingResult<GroupGigResponse>> PayPaidAsync(BookingsDbContext context, long gigId, params (long UserId, decimal Amount, bool? Paid)[] payments)
        => PayBodyAsync(context, gigId, new SetGigPayBody { Payments = payments.Select(p => new GigPayItemBody { UserId = p.UserId, Amount = p.Amount, Paid = p.Paid }).ToList() });

    private Task<List<GroupGigResponse>> GroupGigsAsync(BookingsDbContext context)
        => new GetGroupGigsQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetGroupGigsQuery(GroupId, ManagerId), CancellationToken.None);

    private Task<List<GigResponse>> MyGigsAsync(BookingsDbContext context, long userId)
        => new GetMyGigsQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetMyGigsQuery(userId), CancellationToken.None);

    private Task AnswerAsync(BookingsDbContext context, long gigId, long userId, string status)
        => new SetGigAttendanceCommandHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups)
            .Handle(new SetGigAttendanceCommand(gigId, userId, status), CancellationToken.None);

    [Fact]
    public async Task Detalles_GuardaSetlistHoraYAnticipo_YElPanelDelGrupoLosDevuelve()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody
        {
            Setlist = "1. El son de la negra\n2. Cielito lindo",
            CallTime = new TimeOnly(18, 30),
            DepositAmount = 5000m
        });

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(gig.Id, result.Value!.Id);
        Assert.Equal("Manager", result.Value.Role);

        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Equal("1. El son de la negra\n2. Cielito lindo", row.Setlist);
        Assert.Equal(new TimeOnly(18, 30), row.CallTime);
        Assert.Equal(5000m, row.Deposit.Amount);
        Assert.Null(row.Deposit.ReceivedAt);
    }

    [Fact]
    public async Task Detalles_ActualizaSoloLoEnviado()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = "Cielito lindo", CallTime = new TimeOnly(18, 0), DepositAmount = 3000m });

        var result = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositAmount = 4500m });

        Assert.True(result.IsSuccess, result.Error);
        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Equal("Cielito lindo", row.Setlist);
        Assert.Equal(new TimeOnly(18, 0), row.CallTime);
        Assert.Equal(4500m, row.Deposit.Amount);
    }

    [Fact]
    public async Task Detalles_EnviarNullLimpiaElCampo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = "Cielito lindo", CallTime = new TimeOnly(18, 0), DepositAmount = 3000m });

        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = null, CallTime = null, DepositAmount = null });

        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Null(row.Setlist);
        Assert.Null(row.CallTime);
        Assert.Null(row.Deposit.Amount);
    }

    [Fact]
    public async Task Detalles_SetlistVacioLimpiaElSetlist_SinTocarLoOmitido()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = "Cielito lindo", CallTime = new TimeOnly(18, 0), DepositAmount = 3000m });

        // Lo que manda la UI con los campos vacíos: setlist "" y depositReceived siempre presente; callTime y depositAmount omitidos.
        var result = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = "", DepositReceived = false });

        Assert.True(result.IsSuccess, result.Error);
        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Null(row.Setlist);
        Assert.Equal(new TimeOnly(18, 0), row.CallTime);
        Assert.Equal(3000m, row.Deposit.Amount);
    }

    [Fact]
    public async Task Detalles_DepositReceivedTrueFijaLaFechaAhora_YFalseLaLimpia()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositAmount = 5000m, DepositReceived = true });

        var received = Assert.Single(await GroupGigsAsync(context)).Deposit.ReceivedAt;
        Assert.Equal(Now.UtcDateTime, received);

        // Enviarlo otra vez no mueve la fecha original.
        _scenario.Time = new FixedTimeProvider(Now.AddDays(1));
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositReceived = true });
        Assert.Equal(Now.UtcDateTime, Assert.Single(await GroupGigsAsync(context)).Deposit.ReceivedAt);

        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositReceived = false });
        var cleared = Assert.Single(await GroupGigsAsync(context));
        Assert.Null(cleared.Deposit.ReceivedAt);
        Assert.Equal(5000m, cleared.Deposit.Amount); // el monto no cambia
    }

    [Fact]
    public async Task Detalles_SetlistDeMasDe4000Caracteres_Returns400YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = new string('a', 4001) });

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("El setlist no puede pasar de 4000 caracteres.", result.Error);
        Assert.Null(Assert.Single(await GroupGigsAsync(context)).Setlist);
    }

    [Fact]
    public async Task Detalles_SetlistDeExactamente4000Caracteres_SeGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = new string('a', 4000) });

        Assert.True(result.IsSuccess, result.Error);
    }

    [Fact]
    public async Task Detalles_AnticipoNegativo_Returns400YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositAmount = -1m, Setlist = "no se guarda" });

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("El anticipo no puede ser negativo.", result.Error);
        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Null(row.Deposit.Amount);
        Assert.Null(row.Setlist);
    }

    [Fact]
    public async Task Detalles_ToqueDeOtroGrupo_Returns404()
    {
        await using var context = _fixture.CreateBookingsContext();
        var ajeno = await SeedGigAsync(context, groupId: OtherGroupId);

        var result = await DetailsAsync(context, ajeno.Id, new UpdateGigDetailsBody { Setlist = "x" });

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Toque no encontrado.", result.Error);
    }

    [Fact]
    public async Task Detalles_SolicitudNoAceptada_Returns404()
    {
        await using var context = _fixture.CreateBookingsContext();
        var pendiente = await SeedAsync(context);

        var result = await DetailsAsync(context, pendiente.Id, new UpdateGigDetailsBody { Setlist = "x" });

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Toque no encontrado.", result.Error);
        Assert.Null((await _fixture.CreateBookingsUnitOfWork(context).EventRequests.GetByIdAsync(pendiente.Id))!.Setlist);
    }

    [Fact]
    public async Task Pago_ReemplazaElConjuntoCompleto()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig.Id, MemberId, "Confirmed");
        await AnswerAsync(context, gig.Id, OtherMemberId, "Confirmed");

        var first = await PayAsync(context, gig.Id, (MemberId, 1200m), (OtherMemberId, 900m));
        Assert.True(first.IsSuccess, first.Error);
        Assert.Equal([1200m, 900m], first.Value!.Attendees.OrderBy(a => a.UserId).Select(a => a.Pay));

        var second = await PayAsync(context, gig.Id, (OtherMemberId, 1000m));
        Assert.True(second.IsSuccess, second.Error);

        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Null(row.Attendees.Single(a => a.UserId == MemberId).Pay); // el que ya no está en el conjunto
        Assert.Equal(1000m, row.Attendees.Single(a => a.UserId == OtherMemberId).Pay);

        // Volver a pagarle a quien se quitó revive su fila (el índice único no admite otra).
        var third = await PayAsync(context, gig.Id, (MemberId, 1500m), (OtherMemberId, 1000m));
        Assert.True(third.IsSuccess, third.Error);
        Assert.Equal(1500m, Assert.Single(await GroupGigsAsync(context)).Attendees.Single(a => a.UserId == MemberId).Pay);

        var empty = await PayAsync(context, gig.Id);
        Assert.True(empty.IsSuccess, empty.Error);
        Assert.All(Assert.Single(await GroupGigsAsync(context)).Attendees, a => Assert.Null(a.Pay));
    }

    [Fact]
    public async Task Pago_UsuarioQueNoEsMiembroActivo_Returns400YNoCambiaNada()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig.Id, MemberId, "Confirmed");
        await PayAsync(context, gig.Id, (MemberId, 800m));

        var result = await PayAsync(context, gig.Id, (MemberId, 999m), (OutsiderId, 500m));

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("Solo se puede pagar a miembros activos del grupo.", result.Error);
        Assert.Equal(800m, Assert.Single(await GroupGigsAsync(context)).Attendees.Single().Pay);
    }

    [Fact]
    public async Task Pago_UsuarioDuplicado_Returns400()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await PayAsync(context, gig.Id, (MemberId, 800m), (MemberId, 900m));

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("Cada músico puede aparecer una sola vez.", result.Error);
    }

    [Fact]
    public async Task Pago_MontoNegativo_Returns400()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await PayAsync(context, gig.Id, (MemberId, -1m));

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("El pago no puede ser negativo.", result.Error);
    }

    [Fact]
    public async Task Pago_SinLista_Returns400()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await PayBodyAsync(context, gig.Id, new SetGigPayBody { Payments = null });

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("Envía la lista de pagos.", result.Error);
    }

    [Fact]
    public async Task Pago_ToqueDeOtroGrupoOSinAceptar_Returns404()
    {
        await using var context = _fixture.CreateBookingsContext();
        var ajeno = await SeedGigAsync(context, groupId: OtherGroupId);
        var pendiente = await SeedAsync(context);

        var other = await PayAsync(context, ajeno.Id, (MemberId, 1m));
        var pending = await PayAsync(context, pendiente.Id, (MemberId, 1m));

        Assert.Equal(BookingErrorKind.NotFound, other.ErrorKind);
        Assert.Equal(BookingErrorKind.NotFound, pending.ErrorKind);
    }

    [Fact]
    public async Task Pago_NoSeSumaNiSeComparaConElPresupuesto()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedAsync(context, configure: r => { r.Budget = 100m; r.Accept(null, DateTime.UtcNow); });

        var result = await PayAsync(context, gig.Id, (MemberId, 50000m), (OtherMemberId, 70000m));

        Assert.True(result.IsSuccess, result.Error);
    }

    [Fact]
    public async Task MisToques_MuestraSoloMiPagoYNuncaElDeOtro()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = "Cielito lindo", CallTime = new TimeOnly(18, 30) });
        await PayAsync(context, gig.Id, (MemberId, 1200m), (OtherMemberId, 987m));

        var mine = Assert.Single(await MyGigsAsync(context, MemberId));
        var theirs = Assert.Single(await MyGigsAsync(context, OtherMemberId));
        var unpaid = Assert.Single(await MyGigsAsync(context, ManagerId));

        Assert.Equal(1200m, mine.MyPay);
        Assert.Equal(987m, theirs.MyPay);
        Assert.Null(unpaid.MyPay);
        Assert.Equal("Cielito lindo", mine.Setlist);
        Assert.Equal(new TimeOnly(18, 30), mine.CallTime);
    }

    [Fact]
    public async Task Cliente_VeElAnticipoPeroNoElSetlistLaHoraNiLosPagos()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody
        {
            Setlist = "secreto", CallTime = new TimeOnly(18, 30), DepositAmount = 5000m, DepositReceived = true
        });
        await PayAsync(context, gig.Id, (MemberId, 1200m));

        var result = await new GetEventRequestByIdQueryHandler(
                _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetEventRequestByIdQuery(gig.Id, ClientId, false), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(5000m, result.Value!.Deposit.Amount);
        Assert.Equal(Now.UtcDateTime, result.Value.Deposit.ReceivedAt);
        // Lo que el cliente no ve es lo que se le paga a cada músico (MyPay), no cómo paga él: su
        // método de pago sí viaja desde la ronda 10 (PaymentMethod).
        var properties = typeof(EventRequestResponse).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain(properties, name =>
            name.Contains("Setlist") || name.Contains("CallTime") || name.Contains("MyPay") || name.Contains("PaidAt"));
    }

    // T48 (S18): saldo recibido y pagado como dato.
    [Fact]
    public async Task Saldo_TrueFijaLaFechaAhora_FalseLaLimpiaYOmitidoLaDeja()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        Assert.Null(Assert.Single(await GroupGigsAsync(context)).BalanceReceivedAt);

        var first = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { BalanceReceived = true });
        Assert.True(first.IsSuccess, first.Error);
        Assert.Equal(Now.UtcDateTime, first.Value!.BalanceReceivedAt);
        Assert.Equal(Now.UtcDateTime, Assert.Single(await GroupGigsAsync(context)).BalanceReceivedAt);

        // Enviarlo otra vez no mueve la fecha original.
        _scenario.Time = new FixedTimeProvider(Now.AddDays(1));
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { BalanceReceived = true });
        Assert.Equal(Now.UtcDateTime, Assert.Single(await GroupGigsAsync(context)).BalanceReceivedAt);

        // Omitido no la toca (y tocar otro campo tampoco).
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { Setlist = "Cielito lindo" });
        Assert.Equal(Now.UtcDateTime, Assert.Single(await GroupGigsAsync(context)).BalanceReceivedAt);

        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { BalanceReceived = false });
        Assert.Null(Assert.Single(await GroupGigsAsync(context)).BalanceReceivedAt);
    }

    [Fact]
    public async Task Saldo_NoMueveElAnticipoNiViceversa()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositReceived = true });
        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Equal(Now.UtcDateTime, row.Deposit.ReceivedAt);
        Assert.Null(row.BalanceReceivedAt);

        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { BalanceReceived = true });
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositReceived = false });
        row = Assert.Single(await GroupGigsAsync(context));
        Assert.Null(row.Deposit.ReceivedAt);
        Assert.Equal(Now.UtcDateTime, row.BalanceReceivedAt);
    }

    [Fact]
    public async Task Saldo_ToqueDeOtroGrupoOSinAceptar_Returns404YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var ajeno = await SeedGigAsync(context, groupId: OtherGroupId);
        var pendiente = await SeedAsync(context);

        var other = await DetailsAsync(context, ajeno.Id, new UpdateGigDetailsBody { BalanceReceived = true });
        var pending = await DetailsAsync(context, pendiente.Id, new UpdateGigDetailsBody { BalanceReceived = true });

        Assert.Equal(BookingErrorKind.NotFound, other.ErrorKind);
        Assert.Equal(BookingErrorKind.NotFound, pending.ErrorKind);
        Assert.Null((await _fixture.CreateBookingsUnitOfWork(context).EventRequests.GetByIdAsync(ajeno.Id))!.BalanceReceivedAt);
        Assert.Null((await _fixture.CreateBookingsUnitOfWork(context).EventRequests.GetByIdAsync(pendiente.Id))!.BalanceReceivedAt);
    }

    [Fact]
    public async Task Pagado_ReemplazarElConjuntoDosVeces_ConservaLaFechaOriginalYRespetaTrueFalseYOmitido()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig.Id, MemberId, "Confirmed");
        await AnswerAsync(context, gig.Id, OtherMemberId, "Confirmed");
        DateTime? PaidAt(GroupGigResponse row, long userId) => row.Attendees.Single(a => a.UserId == userId).PaidAt;

        // 1) Primer reemplazo: solo MemberId queda pagado, a las 12:00.
        var first = await PayPaidAsync(context, gig.Id, (MemberId, 1200m, true), (OtherMemberId, 900m, null));
        Assert.True(first.IsSuccess, first.Error);
        Assert.Equal(Now.UtcDateTime, PaidAt(first.Value!, MemberId));
        Assert.Null(PaidAt(first.Value!, OtherMemberId));

        // 2) Segundo reemplazo, otro día, sin "paid": cambia el monto y la fecha sobrevive.
        _scenario.Time = new FixedTimeProvider(Now.AddDays(1));
        var second = await PayPaidAsync(context, gig.Id, (MemberId, 1300m, null), (OtherMemberId, 950m, null));
        Assert.True(second.IsSuccess, second.Error);
        var afterSecond = Assert.Single(await GroupGigsAsync(context));
        Assert.Equal(1300m, afterSecond.Attendees.Single(a => a.UserId == MemberId).Pay);
        Assert.Equal(Now.UtcDateTime, PaidAt(afterSecond, MemberId));
        Assert.Null(PaidAt(afterSecond, OtherMemberId));

        // 3) "paid: true" de nuevo no mueve la fecha original; el otro se paga hoy (día siguiente).
        var third = await PayPaidAsync(context, gig.Id, (MemberId, 1300m, true), (OtherMemberId, 950m, true));
        Assert.True(third.IsSuccess, third.Error);
        Assert.Equal(Now.UtcDateTime, PaidAt(third.Value!, MemberId));
        Assert.Equal(Now.AddDays(1).UtcDateTime, PaidAt(third.Value!, OtherMemberId));

        // 4) "paid: false" la limpia solo a quien lo recibe.
        var fourth = await PayPaidAsync(context, gig.Id, (MemberId, 1300m, false), (OtherMemberId, 950m, null));
        Assert.True(fourth.IsSuccess, fourth.Error);
        var afterFourth = Assert.Single(await GroupGigsAsync(context));
        Assert.Null(PaidAt(afterFourth, MemberId));
        Assert.Equal(Now.AddDays(1).UtcDateTime, PaidAt(afterFourth, OtherMemberId));
    }

    [Fact]
    public async Task Pagado_QuienSaleDelConjuntoPierdeLaFecha_YAlVolverNoLaRecupera()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig.Id, MemberId, "Confirmed");
        await PayPaidAsync(context, gig.Id, (MemberId, 1200m, true));

        await PayPaidAsync(context, gig.Id); // sale del conjunto
        await PayPaidAsync(context, gig.Id, (MemberId, 1500m, null)); // vuelve sin "paid"

        var attendee = Assert.Single(Assert.Single(await GroupGigsAsync(context)).Attendees);
        Assert.Equal(1500m, attendee.Pay);
        Assert.Null(attendee.PaidAt);
    }

    [Fact]
    public async Task Pagado_NoTocaAlQueNoEstaEnLaLista_NiValidaMontos()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig.Id, MemberId, "Confirmed");

        // Pagado en cero y sin relación con el presupuesto: la app solo registra el dato.
        var result = await PayPaidAsync(context, gig.Id, (MemberId, 0m, true));

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(Now.UtcDateTime, result.Value!.Attendees.Single().PaidAt);
    }

    [Fact]
    public async Task MisToques_MuestraCuandoMePagaron_YNuncaCuandoLePagaronAOtro()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await PayPaidAsync(context, gig.Id, (MemberId, 1200m, true), (OtherMemberId, 987m, null));

        var mine = Assert.Single(await MyGigsAsync(context, MemberId));
        var theirs = Assert.Single(await MyGigsAsync(context, OtherMemberId));
        var unpaid = Assert.Single(await MyGigsAsync(context, ManagerId));

        Assert.Equal(Now.UtcDateTime, mine.MyPayPaidAt);
        Assert.Null(theirs.MyPayPaidAt);
        Assert.Equal(987m, theirs.MyPay);
        Assert.Null(unpaid.MyPayPaidAt);
        Assert.Null(unpaid.MyPay);
    }

    [Fact]
    public async Task Cliente_VeElSaldoRecibido_PeroNiElPagoNiLaFechaDePagoDeLosMusicos()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { BalanceReceived = true });
        await PayPaidAsync(context, gig.Id, (MemberId, 1200m, true));

        var result = await new GetEventRequestByIdQueryHandler(
                _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetEventRequestByIdQuery(gig.Id, ClientId, false), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(Now.UtcDateTime, result.Value!.BalanceReceivedAt);
        // Igual que arriba: el pago del músico (MyPay / PaidAt) no viaja; el método del cliente sí.
        var properties = typeof(EventRequestResponse).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain(properties, name =>
            name.Contains("MyPay") || name.Contains("PaidAt") || name.Contains("Setlist"));
    }

    // T61 (S24): el anticipo y el saldo llevan fecha límite, un día del calendario. El manager la
    // carga y el cliente la ve; null la limpia y omitirla no la toca.
    [Fact]
    public async Task FechasLimite_ElManagerLasGuarda_YElClienteLasVeEnSuSolicitud()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var saved = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody
        {
            DepositAmount = 4000m,
            DepositDueDate = new DateOnly(2026, 11, 15),
            BalanceDueDate = new DateOnly(2026, 12, 12)
        });

        Assert.True(saved.IsSuccess, saved.Error);
        Assert.Equal(new DateOnly(2026, 11, 15), saved.Value!.Deposit.DueDate);
        Assert.Equal(new DateOnly(2026, 12, 12), saved.Value!.BalanceDueDate);

        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Equal(new DateOnly(2026, 11, 15), row.Deposit.DueDate);
        Assert.Equal(4000m, row.Deposit.Amount);
        Assert.Equal(new DateOnly(2026, 12, 12), row.BalanceDueDate);

        var client = await new GetEventRequestByIdQueryHandler(
                _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetEventRequestByIdQuery(gig.Id, ClientId, false), CancellationToken.None);
        Assert.True(client.IsSuccess, client.Error);
        Assert.Equal(new DateOnly(2026, 11, 15), client.Value!.Deposit.DueDate);
        Assert.Equal(new DateOnly(2026, 12, 12), client.Value.BalanceDueDate);
    }

    [Fact]
    public async Task FechasLimite_SeGuardanSinMontoYSinFecha_LasDosValen_YNullLimpiaLaFecha()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        // Una fecha sin monto: el manager puede poner el plazo antes de que exista la plata.
        var dateOnly = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositDueDate = new DateOnly(2026, 11, 15) });
        Assert.True(dateOnly.IsSuccess, dateOnly.Error);
        var row = Assert.Single(await GroupGigsAsync(context));
        Assert.Equal(new DateOnly(2026, 11, 15), row.Deposit.DueDate);
        Assert.Null(row.Deposit.Amount);

        // Un monto sin fecha: sigue siendo lo de hoy, y la fecha queda vacía. Omitir la fecha no la
        // limpia (la actualización es parcial), así que se prueba en un toque sin fecha cargada.
        var fresh = await SeedGigAsync(context, eventDate: new DateOnly(2027, 1, 9));
        var amountOnly = await DetailsAsync(context, fresh.Id, new UpdateGigDetailsBody { DepositAmount = 4000m });
        Assert.True(amountOnly.IsSuccess, amountOnly.Error);
        var amountRow = (await GroupGigsAsync(context)).Single(candidate => candidate.Id == fresh.Id);
        Assert.Null(amountRow.Deposit.DueDate);
        Assert.Equal(4000m, amountRow.Deposit.Amount);

        // Omitir la fecha en una actualización posterior tampoco la mueve.
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositAmount = 4000m });
        row = Assert.Single((await GroupGigsAsync(context)).Where(candidate => candidate.Id == gig.Id));
        Assert.Equal(new DateOnly(2026, 11, 15), row.Deposit.DueDate);
        Assert.Equal(4000m, row.Deposit.Amount);

        // La fecha del saldo se guarda y se limpia sin tocar el anticipo.
        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { BalanceDueDate = new DateOnly(2026, 12, 12) });
        row = Assert.Single((await GroupGigsAsync(context)).Where(candidate => candidate.Id == gig.Id));
        Assert.Equal(new DateOnly(2026, 12, 12), row.BalanceDueDate);
        Assert.Equal(4000m, row.Deposit.Amount);

        await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { DepositDueDate = null, BalanceDueDate = null });
        var cleared = Assert.Single((await GroupGigsAsync(context)).Where(candidate => candidate.Id == gig.Id));
        Assert.Null(cleared.BalanceDueDate);
        Assert.Null(cleared.Deposit.DueDate);
        Assert.Equal(4000m, cleared.Deposit.Amount);
    }

    [Fact]
    public async Task FechaLimite_UnaFechaQueYaPaso_SeGuardaIgual_SinValidacionNiAviso()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        // Hoy es 3/11/2026 en el escenario: una fecha límite de octubre ya pasó y es un hecho, no un error.
        var past = await DetailsAsync(context, gig.Id, new UpdateGigDetailsBody { BalanceDueDate = new DateOnly(2026, 10, 1) });

        Assert.True(past.IsSuccess, past.Error);
        Assert.Equal(new DateOnly(2026, 10, 1), Assert.Single(await GroupGigsAsync(context)).BalanceDueDate);
    }

    [Fact]
    public async Task FechasLimite_ToqueDeOtroGrupoOSinAceptar_Returns404YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var ajeno = await SeedGigAsync(context, groupId: OtherGroupId);
        var pendiente = await SeedAsync(context);

        var other = await DetailsAsync(context, ajeno.Id, new UpdateGigDetailsBody { DepositDueDate = new DateOnly(2026, 11, 15) });
        var pending = await DetailsAsync(context, pendiente.Id, new UpdateGigDetailsBody { BalanceDueDate = new DateOnly(2026, 11, 15) });

        Assert.Equal(BookingErrorKind.NotFound, other.ErrorKind);
        Assert.Equal(BookingErrorKind.NotFound, pending.ErrorKind);
        Assert.Null((await _fixture.CreateBookingsUnitOfWork(context).EventRequests.GetByIdAsync(ajeno.Id))!.DepositDueDate);
        Assert.Null((await _fixture.CreateBookingsUnitOfWork(context).EventRequests.GetByIdAsync(pendiente.Id))!.BalanceDueDate);
    }
}
