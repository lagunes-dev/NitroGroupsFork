using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Signals;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// D6 contra PostgreSQL real: la fecha del evento es una columna <c>date</c> y el presupuesto es
/// <c>numeric(12,2)</c>, así que el choque de fecha y la comparación se resuelven en SQL con los
/// tipos reales, no con el proveedor en memoria.
/// </summary>
public class EventRequestSignalsPostgresTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private static readonly DateOnly Date = new(2027, 2, 20);

    private readonly IntegrationTestFixture _fixture = fixture;
    private readonly BookingsTestScenario _scenario = new();

    private static BookingsDbContext Context(string connectionString) =>
        new(new DbContextOptionsBuilder<BookingsDbContext>().UseNpgsql(connectionString).Options);

    private static async Task<EventRequest> SeedAsync(
        BookingsDbContext context,
        decimal? budget = null,
        bool accepted = false,
        DateOnly? eventDate = null)
    {
        var request = new EventRequest
        {
            GroupId = GroupId,
            ClientUserId = ClientId,
            EventDate = eventDate ?? Date,
            StartTime = new TimeOnly(20, 0),
            DurationHours = 4,
            EventType = "Boda",
            LocationText = "Hacienda San Gabriel",
            Budget = budget,
            Message = "Boda con banda en vivo."
        };
        if (accepted)
            request.Accept(null, Now.UtcDateTime);
        request.ClearDomainEvents();
        context.EventRequests.Add(request);
        await context.SaveChangesAsync();
        return request;
    }

    [PostgresFact]
    public async Task Senales_EncuentranElToqueAceptadoDelMismoDiaYComparanElPresupuesto()
    {
        await using var database = await PostgresTestDatabase.CreateAsync();
        await using var context = Context(database.ConnectionString);
        await context.Database.MigrateAsync();

        var request = await SeedAsync(context, budget: 18000m);
        var accepted = await SeedAsync(context, budget: 12000m, accepted: true);
        await SeedAsync(context, accepted: true, eventDate: Date.AddDays(7)); // otro día: no choca

        var handler = new GetEventRequestSignalsQueryHandler(
            _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups);

        var result = await handler.Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        Assert.True(result.Value!.DateClash.Clashes);
        Assert.Equal(accepted.Id, result.Value.DateClash.WithGig!.Id);
        Assert.Equal("Boda", result.Value.DateClash.WithGig.EventType);
        Assert.Equal("Hacienda San Gabriel", result.Value.DateClash.WithGig.LocationText);
        Assert.Equal(18000m, result.Value.Budget.Offered);
        Assert.Equal(12000m, result.Value.Budget.BaseRate);
        Assert.Equal("Above", result.Value.Budget.Status);
    }

    [PostgresFact]
    public async Task Senales_ComparanLosDecimalesExactosDelPresupuesto()
    {
        await using var database = await PostgresTestDatabase.CreateAsync();
        await using var context = Context(database.ConnectionString);
        await context.Database.MigrateAsync();

        var request = await SeedAsync(context, budget: 12000m);

        var handler = new GetEventRequestSignalsQueryHandler(
            _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups);

        var result = await handler.Handle(new GetEventRequestSignalsQuery(GroupId, request.Id), CancellationToken.None);

        Assert.Equal("Equal", result.Value!.Budget.Status);
        Assert.False(result.Value.DateClash.Clashes);
    }
}
