using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Notices;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
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
        Assert.Equal("El aviso tiene que ser de llegada, pago o setlist.", result.Error);
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
}
