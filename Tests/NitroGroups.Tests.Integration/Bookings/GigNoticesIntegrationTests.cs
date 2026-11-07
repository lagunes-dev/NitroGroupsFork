using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Notices;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Repositories;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// S12: el aviso del músico al manager. Se guarda uno por (toque, músico, tipo) y día: apretar dos
/// veces no spammea y responde lo mismo. La lectura del grupo trae el nombre del músico y el tipo;
/// la del músico trae solo lo suyo y solo de hoy.
/// </summary>
public class GigNoticesIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public GigNoticesIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
        _scenario.Groups.GetActiveMemberUserIdsAsync(GroupId, Arg.Any<CancellationToken>())
            .Returns([ManagerId, MemberId, OtherMemberId]);
    }

    private Task<BookingResult<GigNoticeResponse>> SendAsync(
        BookingsDbContext context,
        long gigId,
        string? kind,
        long userId = MemberId,
        long groupId = GroupId)
        => new PostGigNoticeCommandHandler(
                _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users,
                new GigNoticeRepository(context), _scenario.Time)
            .Handle(new PostGigNoticeCommand(groupId, gigId, userId, new PostGigNoticeBody { Kind = kind }), CancellationToken.None);

    private Task<List<GigNoticeResponse>> GroupNoticesAsync(BookingsDbContext context, long groupId = GroupId)
        => new GetGroupGigNoticesQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Users)
            .Handle(new GetGroupGigNoticesQuery(groupId), CancellationToken.None);

    private Task<List<GigNoticeResponse>> MyNoticesTodayAsync(BookingsDbContext context, long userId = MemberId)
        => new GetMyGigNoticesTodayQueryHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Time)
            .Handle(new GetMyGigNoticesTodayQuery(userId), CancellationToken.None);

    private static Task<int> CountAsync(BookingsDbContext context) => context.GigNotices.CountAsync();

    [Fact]
    public async Task Aviso_GuardaElToqueElMusicoElTipoYElDiaEnMexico()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await SendAsync(context, gig.Id, "Pay");

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal((gig.Id, MemberId, "Pay", "Mateo Ruiz"), (
            result.Value!.GigId, result.Value.UserId, result.Value.Kind, result.Value.FullName));
        Assert.Equal(new DateOnly(2026, 11, 3), result.Value.SentOn);
        var row = Assert.Single(await context.GigNotices.ToListAsync());
        Assert.Equal(MemberId, row.CreatedBy);
    }

    [Fact]
    public async Task Aviso_RepetidoElMismoDia_NoGuardaOtraFilaYRespondeLoMismo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var first = await SendAsync(context, gig.Id, "Setlist");
        var second = await SendAsync(context, gig.Id, "Setlist");

        Assert.True(first.IsSuccess, first.Error);
        Assert.True(second.IsSuccess, second.Error);
        Assert.Equal(first.Value!.Id, second.Value!.Id);
        Assert.Equal(first.Value.SentOn, second.Value.SentOn);
        Assert.Equal(1, await CountAsync(context));
    }

    [Fact]
    public async Task Aviso_ElMismoTipoEnOtroDia_SeGuardaDeNuevo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        await SendAsync(context, gig.Id, "Pay");
        _scenario.Time = new FixedTimeProvider(Now.AddDays(1));
        var nextDay = await SendAsync(context, gig.Id, "Pay");

        Assert.True(nextDay.IsSuccess, nextDay.Error);
        Assert.Equal(new DateOnly(2026, 11, 4), nextDay.Value!.SentOn);
        Assert.Equal(2, await CountAsync(context));
    }

    [Fact]
    public async Task Aviso_CadaTipoEsUnAvisoDistinto()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        foreach (var kind in new[] { "CallTime", "Pay", "Setlist" })
            Assert.True((await SendAsync(context, gig.Id, kind)).IsSuccess);

        Assert.Equal(3, await CountAsync(context));
        Assert.Equal(["CallTime", "Pay", "Setlist"], (await MyNoticesTodayAsync(context)).Select(row => row.Kind));
    }

    [Theory]
    [InlineData("Chat")]
    [InlineData("pay")]
    [InlineData("")]
    [InlineData(null)]
    public async Task Aviso_TipoFueraDeLosTresDelContrato_Returns400YNoGuarda(string? kind)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await SendAsync(context, gig.Id, kind);

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("El aviso tiene que ser de llegada, pago, setlist, llegada tarde, lugar o pago sin recibir.", result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task Aviso_QuienNoEsMiembroActivoDelGrupo_Returns403YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await SendAsync(context, gig.Id, "Pay", userId: OutsiderId);

        Assert.Equal(BookingErrorKind.Forbidden, result.ErrorKind);
        Assert.Equal("Solo un miembro activo del grupo puede avisar del toque.", result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task Aviso_MiembroQueYaNoEstaActivo_Returns403YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        _scenario.Groups.GetActiveMemberUserIdsAsync(GroupId, Arg.Any<CancellationToken>()).Returns([ManagerId]);

        var result = await SendAsync(context, gig.Id, "Pay");

        Assert.Equal(BookingErrorKind.Forbidden, result.ErrorKind);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task Aviso_ToqueSinAceptar_Returns409YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var pending = await SeedAsync(context);

        var result = await SendAsync(context, pending.Id, "Pay");

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Solo se puede avisar de un toque aceptado.", result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task Aviso_ToqueDeOtroGrupo_Returns404YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var foreign = await SeedGigAsync(context, groupId: OtherGroupId);

        var result = await SendAsync(context, foreign.Id, "Pay");

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Toque no encontrado.", result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task Aviso_ToqueQueNoExiste_Returns404()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await SendAsync(context, 404, "Pay");

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
    }

    [Fact]
    public async Task AvisoDeCualquierMiembroActivo_NoSoloDelManager()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var member = await SendAsync(context, gig.Id, "CallTime", userId: OtherMemberId);
        var manager = await SendAsync(context, gig.Id, "CallTime", userId: ManagerId);

        Assert.True(member.IsSuccess, member.Error);
        Assert.True(manager.IsSuccess, manager.Error);
        Assert.Equal("Sofía Nava", member.Value!.FullName);
        Assert.Equal("Pedro Vargas", manager.Value!.FullName);
    }

    [Fact]
    public async Task LecturaDelGrupo_TraeElNombreYElTipo_DelMasRecienteAlMasAntiguo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await SendAsync(context, gig.Id, "CallTime", userId: MemberId);
        _scenario.Time = new FixedTimeProvider(Now.AddHours(1));
        await SendAsync(context, gig.Id, "Pay", userId: OtherMemberId);

        var rows = await GroupNoticesAsync(context);

        Assert.Equal(["Sofía Nava", "Mateo Ruiz"], rows.Select(row => row.FullName));
        Assert.Equal(["Pay", "CallTime"], rows.Select(row => row.Kind));
        Assert.All(rows, row => Assert.Equal(gig.Id, row.GigId));
    }

    [Fact]
    public async Task LecturaDelGrupo_NoMezclaLosAvisosDeOtroGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var mine = await SeedGigAsync(context);
        var foreign = await SeedGigAsync(context, groupId: OtherGroupId);
        await SendAsync(context, mine.Id, "Pay");
        await SendAsync(context, foreign.Id, "Pay", groupId: OtherGroupId);

        var rows = await GroupNoticesAsync(context);

        Assert.Equal(mine.Id, Assert.Single(rows).GigId);
    }

    [Fact]
    public async Task LecturaDelGrupo_SinAvisos_DevuelveListaVacia()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedGigAsync(context);

        Assert.Empty(await GroupNoticesAsync(context));
    }

    [Fact]
    public async Task MisAvisosDeHoy_SoloLosMiosY_SoloLosDeHoy()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await SendAsync(context, gig.Id, "Pay", userId: MemberId);
        await SendAsync(context, gig.Id, "Pay", userId: OtherMemberId);
        _scenario.Time = new FixedTimeProvider(Now.AddDays(1));
        await SendAsync(context, gig.Id, "Setlist", userId: MemberId);

        var mine = await MyNoticesTodayAsync(context);

        Assert.Equal(["Setlist"], mine.Select(row => row.Kind));
        Assert.Equal(new DateOnly(2026, 11, 4), Assert.Single(mine).SentOn);
    }

    // T47 / S17: "Llego tarde" y "No encuentro el lugar" solo valen para un toque que no ya pasó.

    [Theory]
    [InlineData("Late")]
    [InlineData("CannotFindVenue")]
    public async Task AvisoDeLlegadaOLugar_ToqueAceptadoFuturo_SeGuardaConElDiaEnMexico(string kind)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await SendAsync(context, gig.Id, kind);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal((gig.Id, MemberId, kind, "Mateo Ruiz"), (
            result.Value!.GigId, result.Value.UserId, result.Value.Kind, result.Value.FullName));
        Assert.Equal(new DateOnly(2026, 11, 3), result.Value.SentOn);
        Assert.Equal(1, await CountAsync(context));
    }

    [Fact]
    public async Task AvisoDeLlegadaOLugar_ToqueDeHoyEnMexico_SeGuarda()
    {
        // Hoy son las 12:00 en CDMX (18:00 UTC): el toque de esta noche todavía no pasó.
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 3));

        var result = await SendAsync(context, gig.Id, "Late");

        Assert.True(result.IsSuccess, result.Error);
    }

    [Fact]
    public async Task AvisoDeLlegadaOLugar_MadrugadaUtcQueSigueSiendoElMismoDiaEnMexico_ElToqueDeEseDiaNoPaso()
    {
        // 04:00 UTC del 4/11 son las 22:00 del 3/11 en México: el toque del 3 sigue vigente.
        _scenario.Time = new FixedTimeProvider(new DateTimeOffset(2026, 11, 4, 4, 0, 0, TimeSpan.Zero));
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 3));

        var result = await SendAsync(context, gig.Id, "CannotFindVenue");

        Assert.True(result.IsSuccess, result.Error);
    }

    [Theory]
    [InlineData("Late")]
    [InlineData("CannotFindVenue")]
    public async Task AvisoDeLlegadaOLugar_ToquePasado_Returns409YNoGuarda(string kind)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 2));

        var result = await SendAsync(context, gig.Id, kind);

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal("Ese toque ya pasó: ya no se puede avisar que llegas tarde o que no encuentras el lugar.", result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task AvisoDeFaltante_ToquePasado_SigueGuardandose()
    {
        // Las reglas nuevas son solo de los dos tipos nuevos: los tres de siempre no cambian.
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 2));

        var result = await SendAsync(context, gig.Id, "Pay");

        Assert.True(result.IsSuccess, result.Error);
    }

    [Theory]
    [InlineData("Late")]
    [InlineData("CannotFindVenue")]
    public async Task AvisoDeLlegadaOLugar_RepetidoElMismoDia_NoGuardaOtraFila(string kind)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var first = await SendAsync(context, gig.Id, kind);
        var second = await SendAsync(context, gig.Id, kind);

        Assert.Equal(first.Value!.Id, second.Value!.Id);
        Assert.Equal(1, await CountAsync(context));
    }

    [Theory]
    [InlineData("Late")]
    [InlineData("CannotFindVenue")]
    public async Task AvisoDeLlegadaOLugar_NoMiembro_Returns403_ToqueSinAceptar_Returns409(string kind)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        var pending = await SeedAsync(context);

        var outsider = await SendAsync(context, gig.Id, kind, userId: OutsiderId);
        var notAccepted = await SendAsync(context, pending.Id, kind);

        Assert.Equal(BookingErrorKind.Forbidden, outsider.ErrorKind);
        Assert.Equal(BookingErrorKind.Conflict, notAccepted.ErrorKind);
        Assert.Equal("Solo se puede avisar de un toque aceptado.", notAccepted.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task LasLecturas_DevuelvenLosCincoTiposComoLosDemas()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        foreach (var kind in new[] { "Late", "CannotFindVenue", "Pay" })
            Assert.True((await SendAsync(context, gig.Id, kind)).IsSuccess);

        Assert.Equal(["Late", "CannotFindVenue", "Pay"], (await MyNoticesTodayAsync(context)).Select(row => row.Kind));
        Assert.Equal(["Pay", "CannotFindVenue", "Late"], (await GroupNoticesAsync(context)).Select(row => row.Kind));
    }

    // T58 / S21: "No me pagaron" solo vale en un toque que ya fue y con un pago pendiente del llamante.
    private const string UnpaidNotPastMessage = "Todavía no puedes avisar que no te pagaron: ese toque no ha pasado.";
    private const string UnpaidDeclinedMessage = "Avisaste que no podías ir a ese toque, así que no hay pago que reclamar.";
    private const string UnpaidNothingPendingMessage = "No tienes un pago pendiente en ese toque.";

    private static async Task SeedPayAsync(
        BookingsDbContext context,
        long gigId,
        long userId = MemberId,
        DateTime? paidAt = null)
    {
        context.GigPays.Add(new GigPay
        {
            EventRequestId = gigId,
            UserId = userId,
            Amount = 1500m,
            PaidAt = paidAt,
            CreatedBy = ManagerId
        });
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task AvisoDeQueNoPagaron_ToquePasadoConPagoPendiente_SeGuardaYSeLeeEnLosDosLados()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 2));
        await SeedPayAsync(context, gig.Id);

        var result = await SendAsync(context, gig.Id, "Unpaid");

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal((gig.Id, MemberId, "Unpaid", "Mateo Ruiz"), (
            result.Value!.GigId, result.Value.UserId, result.Value.Kind, result.Value.FullName));
        Assert.Equal(new DateOnly(2026, 11, 3), result.Value.SentOn);
        var row = Assert.Single(await context.GigNotices.ToListAsync());
        Assert.Equal(MemberId, row.CreatedBy);

        // El manager lo lee en el hilo y el músico en el suyo de hoy, como cualquier otro tipo.
        Assert.Equal(["Unpaid"], (await GroupNoticesAsync(context)).Select(notice => notice.Kind));
        Assert.Equal(["Unpaid"], (await MyNoticesTodayAsync(context)).Select(notice => notice.Kind));
    }

    [Theory]
    [InlineData("2026-11-03")]
    [InlineData("2026-12-12")]
    public async Task AvisoDeQueNoPagaron_ToqueQueNoHaPasado_Returns409YNoGuarda(string eventDate)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: DateOnly.Parse(eventDate));
        await SeedPayAsync(context, gig.Id);

        var result = await SendAsync(context, gig.Id, "Unpaid");

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal(UnpaidNotPastMessage, result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task AvisoDeQueNoPagaron_SiAvisoQueNoIba_Returns409YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 2));
        await SeedPayAsync(context, gig.Id, paidAt: null);
        // Dijo que no podía ir: no tocó, así que no hay pago que reclamar. Antes el backend lo aceptaba
        // mientras la tarjeta escondía el aviso; ahora los dos dicen lo mismo.
        await context.GigAttendances.AddAsync(new GigAttendance
        {
            EventRequestId = gig.Id,
            UserId = MemberId,
            Status = GigAttendanceStatus.Declined,
            CreatedBy = MemberId,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var result = await SendAsync(context, gig.Id, "Unpaid");

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal(UnpaidDeclinedMessage, result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    public async Task AvisoDeQueNoPagaron_PagoYaRegistrado_Returns409YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 2));
        await SeedPayAsync(context, gig.Id, paidAt: new DateTime(2026, 11, 2, 18, 0, 0, DateTimeKind.Utc));

        var result = await SendAsync(context, gig.Id, "Unpaid");

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal(UnpaidNothingPendingMessage, result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task AvisoDeQueNoPagaron_SinPagoPendientePropio_Returns409YNoGuarda()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 2));
        // Hay un pago, pero es de otro músico: al llamante no se le debe nada en ese toque.
        await SeedPayAsync(context, gig.Id, userId: OtherMemberId);

        var result = await SendAsync(context, gig.Id, "Unpaid");

        Assert.Equal(BookingErrorKind.Conflict, result.ErrorKind);
        Assert.Equal(UnpaidNothingPendingMessage, result.Error);
        Assert.Equal(0, await CountAsync(context));
    }

    [Fact]
    public async Task AvisoDeQueNoPagaron_RepetidoElMismoDia_NoGuardaOtraFila()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 2));
        await SeedPayAsync(context, gig.Id);

        var first = await SendAsync(context, gig.Id, "Unpaid");
        var second = await SendAsync(context, gig.Id, "Unpaid");

        Assert.True(first.IsSuccess, first.Error);
        Assert.True(second.IsSuccess, second.Error);
        Assert.Equal(first.Value!.Id, second.Value!.Id);
        Assert.Equal(1, await CountAsync(context));
    }
}
