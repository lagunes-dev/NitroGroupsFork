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
        => new SetGigPayCommandHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users)
            .Handle(new SetGigPayCommand(groupId, gigId, ManagerId, body), CancellationToken.None);

    private Task<List<GroupGigResponse>> GroupGigsAsync(BookingsDbContext context)
        => new GetGroupGigsQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time)
            .Handle(new GetGroupGigsQuery(GroupId, ManagerId), CancellationToken.None);

    private Task<List<GigResponse>> MyGigsAsync(BookingsDbContext context, long userId)
        => new GetMyGigsQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Time)
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
        var properties = typeof(EventRequestResponse).GetProperties().Select(p => p.Name);
        Assert.DoesNotContain(properties, name => name.Contains("Setlist") || name.Contains("CallTime") || name.Contains("Pay"));
    }
}
