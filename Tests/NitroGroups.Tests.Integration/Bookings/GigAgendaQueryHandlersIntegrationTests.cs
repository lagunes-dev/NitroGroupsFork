using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// S1 y S4: la agenda del miembro (<c>GET api/me/gigs</c>) solo muestra toques aceptados de grupos
/// donde tiene membresía activa, y nunca solicitudes pendientes, rechazadas o canceladas.
/// </summary>
public class GigAgendaQueryHandlersIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public GigAgendaQueryHandlersIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    private GetMyGigsQueryHandler Handler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);

    [Fact]
    public async Task MisToques_SoloDeMisGrupos_LosAceptados_OrdenadosPorFechaYHora()
    {
        await using var context = _fixture.CreateBookingsContext();
        var tarde = await SeedGigAsync(context, eventDate: new DateOnly(2026, 12, 12), startTime: new TimeOnly(20, 0));
        var temprano = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 20), startTime: new TimeOnly(18, 0));
        var mismoDiaPrimero = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 20), startTime: new TimeOnly(9, 0));
        await SeedGigAsync(context, groupId: OtherGroupId); // no soy miembro de ese grupo

        var result = await Handler(context).Handle(new GetMyGigsQuery(MemberId), CancellationToken.None);

        Assert.Equal([mismoDiaPrimero.Id, temprano.Id, tarde.Id], result.Select(g => g.Id));
    }

    [Fact]
    public async Task MisToques_DevuelveLaFilaDelContrato_ConMiRolYAsistenciaNulaHastaQueRespondo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var sinResponder = Assert.Single(await Handler(context).Handle(new GetMyGigsQuery(MemberId), CancellationToken.None));

        Assert.Equal(gig.Id, sinResponder.Id);
        Assert.Equal(GroupId, sinResponder.GroupId);
        Assert.Equal("Los Vargas", sinResponder.GroupName);
        Assert.Equal("los-vargas", sinResponder.GroupSlug);
        Assert.Equal(FutureDate, sinResponder.EventDate);
        Assert.Equal(new TimeOnly(20, 0), sinResponder.StartTime!.Value);
        Assert.Equal(4, sinResponder.DurationHours);
        Assert.Equal("XV años", sinResponder.EventType);
        Assert.Equal("Jardín Las Flores", sinResponder.LocationText);
        Assert.Equal("Member", sinResponder.Role);
        Assert.Null(sinResponder.Attendance);

        await new SetGigAttendanceCommandHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups)
            .Handle(new SetGigAttendanceCommand(gig.Id, MemberId, "Confirmed"), CancellationToken.None);

        var respondida = Assert.Single(await Handler(context).Handle(new GetMyGigsQuery(MemberId), CancellationToken.None));
        Assert.Equal("Confirmed", respondida.Attendance);
    }

    [Fact]
    public async Task MisToques_ElRolEsElDeMiMembresia()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedGigAsync(context);

        var delManager = Assert.Single(await Handler(context).Handle(new GetMyGigsQuery(ManagerId), CancellationToken.None));
        var delMiembro = Assert.Single(await Handler(context).Handle(new GetMyGigsQuery(MemberId), CancellationToken.None));

        Assert.Equal("Manager", delManager.Role);
        Assert.Equal("Member", delMiembro.Role);
    }

    [Fact]
    public async Task MisToques_SinMembresiaActiva_NoVeLosToquesDeEseGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var deVargas = await SeedGigAsync(context);
        var delOtro = await SeedGigAsync(context, groupId: OtherGroupId);

        // Membresía dada de baja: el contrato de Groups solo devuelve las activas.
        _scenario.SetMemberships(MemberId, Membership(OtherGroupId, GroupMemberRole.Member));

        var result = await Handler(context).Handle(new GetMyGigsQuery(MemberId), CancellationToken.None);

        Assert.Equal([delOtro.Id], result.Select(g => g.Id));
        Assert.DoesNotContain(result, gig => gig.Id == deVargas.Id);
    }

    [Fact]
    public async Task MisToques_SinNingunaMembresia_NoVeNada()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedGigAsync(context);
        await SeedGigAsync(context, groupId: OtherGroupId);

        var result = await Handler(context).Handle(new GetMyGigsQuery(OutsiderId), CancellationToken.None);

        Assert.Empty(result);
    }

    [Theory]
    [InlineData(EventRequestStatus.Pending)]
    [InlineData(EventRequestStatus.Declined)]
    [InlineData(EventRequestStatus.Cancelled)]
    public async Task MisToques_NuncaMuestraSolicitudesQueNoEstanAceptadas(EventRequestStatus status)
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedAsync(context, configure: request =>
        {
            if (status == EventRequestStatus.Declined)
                request.Decline(null, DateTime.UtcNow);
            else if (status == EventRequestStatus.Cancelled)
                request.Cancel(EventRequestParty.Client);
        });
        var aceptado = await SeedGigAsync(context);

        var result = await Handler(context).Handle(new GetMyGigsQuery(MemberId), CancellationToken.None);

        Assert.Equal([aceptado.Id], result.Select(g => g.Id));
    }

    [Fact]
    public async Task MisToques_VeDesdeHaceTreintaDias_YNoMasViejo()
    {
        // Hoy en México es el 3/11/2026, así que el corte es el 4/10/2026 (incluido).
        await using var context = _fixture.CreateBookingsContext();
        var enElCorte = await SeedGigAsync(context, eventDate: new DateOnly(2026, 10, 4));
        await SeedGigAsync(context, eventDate: new DateOnly(2026, 10, 3));

        var result = await Handler(context).Handle(new GetMyGigsQuery(MemberId), CancellationToken.None);

        Assert.Equal([enElCorte.Id], result.Select(g => g.Id));
    }
}
