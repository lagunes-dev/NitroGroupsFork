using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Signals;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// D6: las dos señales del hilo del manager, calculadas con datos que ya existen.
/// Un choque de fecha es otro toque <b>aceptado</b> del mismo grupo en el mismo día; el
/// presupuesto compara lo que ofrece el cliente con el "desde $X" del grupo, sin cobrar nada.
/// </summary>
public class EventRequestSignalsIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private static readonly DateOnly Date = new(2026, 12, 12);
    private static readonly DateOnly OtherDate = new(2026, 12, 19);

    private readonly IntegrationTestFixture _fixture = fixture;
    private readonly BookingsTestScenario _scenario = new();

    private GetEventRequestSignalsQueryHandler Handler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups);

    // ---------- Choque de fecha ----------

    [Fact]
    public async Task ChoqueDeFecha_NombraElOtroToqueAceptadoDelMismoDia()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, eventDate: Date); // el pedido pending que abre el hilo
        var other = await SeedGigAsync(context, eventDate: Date, startTime: new TimeOnly(18, 0));

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var clash = result.Value!.DateClash;
        Assert.True(clash.Clashes);
        Assert.NotNull(clash.WithGig);
        Assert.Equal(other.Id, clash.WithGig!.Id);
        Assert.Equal("XV años", clash.WithGig.EventType);
        Assert.Equal("Jardín Las Flores", clash.WithGig.LocationText);
        // Reloj de 24 horas: un toque de las 18:00 no puede viajar como "06:00" (ronda 5, Mónica).
        Assert.Equal("18:00", clash.WithGig.StartTime);
        Assert.Equal(4, clash.WithGig.DurationHours);
    }

    [Fact]
    public async Task ChoqueDeFecha_IgnoraLosToquesDeOtroGrupoYLasSolicitudesSinAceptar()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, eventDate: Date);
        await SeedGigAsync(context, groupId: OtherGroupId, eventDate: Date);          // otro grupo
        await SeedGigAsync(context, eventDate: OtherDate);                            // otro día
        await SeedAsync(context, eventDate: Date);                                    // misma fecha, sin aceptar
        await SeedAsync(context, eventDate: Date, configure: r => r.Decline(null, Now.UtcDateTime));
        await SeedAsync(context, eventDate: Date, configure: r => r.Cancel(EventRequestParty.Client));

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var clash = result.Value!.DateClash;
        Assert.False(clash.Clashes);
        Assert.Null(clash.WithGig);
    }

    [Fact]
    public async Task ChoqueDeFecha_NoSeComparaConsigoMismo()
    {
        await using var context = _fixture.CreateBookingsContext();
        // El pedido del hilo ya está aceptado (el grupo lo aceptó y sigue conversando).
        var request = await SeedAsync(context, eventDate: Date, configure: r => r.Accept(null, Now.UtcDateTime));

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        var clash = result.Value!.DateClash;
        Assert.False(clash.Clashes);
        Assert.Null(clash.WithGig);
    }

    // ---------- Presupuesto contra tarifa base ----------

    [Theory]
    [InlineData(18000, "Above")]
    [InlineData(9000, "Below")]
    [InlineData(12000, "Equal")]
    public async Task Presupuesto_ComparaOfrecidoConLaTarifaBaseDelGrupo(int offered, string expected)
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, eventDate: Date, configure: r => r.Budget = offered);

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var budget = result.Value!.Budget;
        Assert.Equal(offered, budget.Offered);
        Assert.Equal(12000m, budget.BaseRate);
        Assert.Equal(expected, budget.Status);
    }

    [Fact]
    public async Task Presupuesto_SinMontoOfrecido_EsUnknownYNoInventaLaComparacion()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, eventDate: Date); // sin presupuesto

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        var budget = result.Value!.Budget;
        Assert.Null(budget.Offered);
        Assert.Equal(12000m, budget.BaseRate);
        Assert.Equal("Unknown", budget.Status);
    }

    [Fact]
    public async Task Presupuesto_SinTarifaBaseEnElGrupo_EsUnknown()
    {
        await using var context = _fixture.CreateBookingsContext();
        // El grupo 20 del escenario no tiene tarifa base cargada.
        var request = await SeedAsync(context, groupId: OtherGroupId, eventDate: Date, configure: r => r.Budget = 18000m);

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(OtherGroupId, request.Id), CancellationToken.None);

        var budget = result.Value!.Budget;
        Assert.Equal(18000m, budget.Offered);
        Assert.Null(budget.BaseRate);
        Assert.Equal("Unknown", budget.Status);
    }

    [Fact]
    public async Task LaTarifaBaseSaleDelResumenDelGrupo_NoDeLasTablasDeGroups()
    {
        await using var groups = _fixture.CreateGroupsContext();
        var group = new Group
        {
            OwnerUserId = ManagerId,
            Slug = $"los-vargas-{Guid.NewGuid():N}",
            GroupName = "Los Vargas",
            Currency = "MXN",
            BasePrice = 9500m,
            Active = true
        };
        groups.Groups.Add(group);
        await groups.SaveChangesAsync();

        var summary = await new GroupsModuleApi(groups).GetGroupAsync(group.Id);
        Assert.NotNull(summary);
        Assert.Equal(9500m, summary!.BasePrice);
        // Lo que el resumen ya traía sigue igual: el cambio solo agrega la tarifa base.
        Assert.Equal("Los Vargas", summary.GroupName);
        Assert.Equal(group.Slug, summary.Slug);
        Assert.Equal(ManagerId, summary.OwnerUserId);
        Assert.True(summary.IsActive);

        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, groupId: group.Id, eventDate: Date, configure: r => r.Budget = 9500m);

        // El adaptador real de Groups alimenta las señales: Bookings no lee el esquema de grupos.
        var handler = new GetEventRequestSignalsQueryHandler(
            _fixture.CreateBookingsUnitOfWork(context), new GroupsModuleApi(groups));

        var result = await handler.Handle(new GetEventRequestSignalsQuery(group.Id, request.Id), CancellationToken.None);

        Assert.Equal(9500m, result.Value!.Budget.BaseRate);
        Assert.Equal("Equal", result.Value.Budget.Status);
    }

    // ---------- La solicitud tiene que ser de ese grupo ----------

    [Fact]
    public async Task SolicitudDeOtroGrupo_NoSeEncuentra()
    {
        await using var context = _fixture.CreateBookingsContext();
        var request = await SeedAsync(context, groupId: OtherGroupId, eventDate: Date);

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
        Assert.Equal("Solicitud no encontrada.", result.Error);
    }

    [Fact]
    public async Task SolicitudInexistente_NoSeEncuentra()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await Handler(context).Handle(new GetEventRequestSignalsQuery(GroupId, 404404), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(BookingErrorKind.NotFound, result.ErrorKind);
    }
}
