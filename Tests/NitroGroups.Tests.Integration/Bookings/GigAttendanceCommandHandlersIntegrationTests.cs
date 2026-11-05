using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// S3 y S4: el miembro responde "Confirmo" o "No puedo" y su respuesta se guarda (upsert, una
/// fila por toque y persona); quien no es miembro activo recibe 404 sin saber si el toque existe.
/// </summary>
public class GigAttendanceCommandHandlersIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public GigAttendanceCommandHandlersIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    private SetGigAttendanceCommandHandler Handler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups);

    [Fact]
    public async Task Responder_GuardaLaRespuestaYLaDevuelve()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await Handler(context).Handle(
            new SetGigAttendanceCommand(gig.Id, MemberId, "Confirmed"), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.Equal(gig.Id, result.Value!.Id);
        Assert.Equal("Confirmed", result.Value.Attendance);

        var saved = await context.GigAttendances.SingleAsync();
        Assert.Equal(gig.Id, saved.EventRequestId);
        Assert.Equal(MemberId, saved.UserId);
        Assert.Equal(GigAttendanceStatus.Confirmed, saved.Status);
    }

    [Fact]
    public async Task Responder_DosVeces_ActualizaLaMismaFila()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var confirmo = await Handler(context).Handle(new SetGigAttendanceCommand(gig.Id, MemberId, "Confirmed"), CancellationToken.None);
        var noPuedo = await Handler(context).Handle(new SetGigAttendanceCommand(gig.Id, MemberId, "Declined"), CancellationToken.None);

        Assert.True(confirmo.IsSuccess, confirmo.Error);
        Assert.True(noPuedo.IsSuccess, noPuedo.Error);
        Assert.Equal("Declined", noPuedo.Value!.Attendance);

        context.ChangeTracker.Clear();
        var saved = Assert.Single(await context.GigAttendances.Where(a => a.EventRequestId == gig.Id && a.UserId == MemberId).ToListAsync());
        Assert.Equal(GigAttendanceStatus.Declined, saved.Status);
        Assert.Equal(1, await context.GigAttendances.CountAsync());
    }

    [Fact]
    public async Task Responder_CadaMiembroTieneSuPropiaFila()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        await Handler(context).Handle(new SetGigAttendanceCommand(gig.Id, MemberId, "Confirmed"), CancellationToken.None);
        await Handler(context).Handle(new SetGigAttendanceCommand(gig.Id, OtherMemberId, "Declined"), CancellationToken.None);

        var saved = await context.GigAttendances.OrderBy(a => a.UserId).ToListAsync();
        Assert.Equal([MemberId, OtherMemberId], saved.Select(a => a.UserId));
        Assert.Equal(
            [GigAttendanceStatus.Confirmed, GigAttendanceStatus.Declined],
            saved.Select(a => a.Status));
    }

    [Theory]
    [InlineData(OutsiderId)] // no pertenece a ningún grupo
    [InlineData(ClientId)] // es la clienta de la solicitud, no una miembro del grupo
    public async Task Responder_SinMembresiaActiva_DevuelveNotFoundYNoGuardaNada(long userId)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await Handler(context).Handle(new SetGigAttendanceCommand(gig.Id, userId, "Confirmed"), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Toque no encontrado.", result.Error);
        Assert.Empty(context.GigAttendances);
    }

    [Fact]
    public async Task Responder_MiembroDeOtroGrupo_DevuelveElMismoNotFoundQueUnToqueInexistente()
    {
        await using var context = _fixture.CreateBookingsContext();
        var ajeno = await SeedGigAsync(context, groupId: OtherGroupId);

        var delOtroGrupo = await Handler(context).Handle(new SetGigAttendanceCommand(ajeno.Id, MemberId, "Confirmed"), CancellationToken.None);
        var inexistente = await Handler(context).Handle(new SetGigAttendanceCommand(ajeno.Id + 1000, MemberId, "Confirmed"), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, delOtroGrupo.ErrorKind);
        Assert.Equal(inexistente.ErrorKind, delOtroGrupo.ErrorKind);
        Assert.Equal(inexistente.Error, delOtroGrupo.Error);
        Assert.Empty(context.GigAttendances);
    }

    [Theory]
    [InlineData(EventRequestStatus.Pending)]
    [InlineData(EventRequestStatus.Declined)]
    [InlineData(EventRequestStatus.Cancelled)]
    public async Task Responder_UnaSolicitudQueNoEsToque_DevuelveNotFoundYNoGuarda(EventRequestStatus status)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, configure: r =>
        {
            if (status == EventRequestStatus.Declined)
                r.Decline(null, DateTime.UtcNow);
            else if (status == EventRequestStatus.Cancelled)
                r.Cancel(EventRequestParty.Client);
        });

        var result = await Handler(context).Handle(new SetGigAttendanceCommand(request.Id, MemberId, "Confirmed"), CancellationToken.None);

        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Empty(context.GigAttendances);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("Maybe")]
    [InlineData("confirmed")] // el contrato usa exactamente "Confirmed" y "Declined"
    [InlineData("0")] // un enum numérico no es un estado válido
    public async Task Responder_EstadoInvalido_DevuelveValidationYNoGuarda(string? status)
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);

        var result = await Handler(context).Handle(new SetGigAttendanceCommand(gig.Id, MemberId, status), CancellationToken.None);

        Assert.Equal(BookingErrorKind.Validation, result.ErrorKind);
        Assert.Equal("La asistencia debe ser \"Confirmed\" o \"Declined\".", result.Error);
        Assert.Empty(context.GigAttendances);
    }
}
