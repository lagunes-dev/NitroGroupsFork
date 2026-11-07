using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// El pago por músico es único por (toque, usuario) y no negativo a nivel de base de datos:
/// el índice único y el CHECK de <c>bookings.gig_pay</c> lo garantizan.
/// </summary>
public class GigPayPostgresTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private const long MemberId = 7;

    private static BookingsDbContext Context(string cs) =>
        new(new DbContextOptionsBuilder<BookingsDbContext>().UseNpgsql(cs).Options);

    private static async Task<long> SeedAcceptedAsync(BookingsDbContext context)
    {
        var request = new EventRequest
        {
            GroupId = 101, ClientUserId = 3, EventDate = new DateOnly(2027, 1, 15), DurationHours = 3,
            EventType = "Boda", LocationText = "Salón Los Arcos", Message = "Queremos mariachi en la recepción.",
        };
        request.Accept(null, DateTime.UtcNow);
        request.ClearDomainEvents();
        context.EventRequests.Add(request);
        await context.SaveChangesAsync();
        return request.Id;
    }

    [PostgresFact]
    public async Task LaTablaNoAdmiteDosPagosDelMismoMusicoAlMismoToque()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);

        ctx.GigPays.AddRange(
            new GigPay { EventRequestId = gigId, UserId = MemberId, Amount = 100m },
            new GigPay { EventRequestId = gigId, UserId = MemberId, Amount = 200m });

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task LaTablaNoAdmiteUnPagoNegativo()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);

        ctx.GigPays.Add(new GigPay { EventRequestId = gigId, UserId = MemberId, Amount = -1m });

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task ElToqueGuardaSetlistHoraYAnticipo()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);

        var gig = await ctx.EventRequests.SingleAsync(r => r.Id == gigId);
        gig.SetSetlist("Cielito lindo");
        gig.SetCallTime(new TimeOnly(18, 30));
        gig.SetDepositAmount(1234.56m);
        gig.SetDepositReceived(true, new DateTime(2026, 11, 3, 18, 0, 0, DateTimeKind.Utc));
        await ctx.SaveChangesAsync();

        await using var check = Context(db.ConnectionString);
        var saved = await check.EventRequests.SingleAsync(r => r.Id == gigId);
        Assert.Equal("Cielito lindo", saved.Setlist);
        Assert.Equal(new TimeOnly(18, 30), saved.CallTime);
        Assert.Equal(1234.56m, saved.DepositAmount);
        Assert.Equal(new DateTime(2026, 11, 3, 18, 0, 0, DateTimeKind.Utc), saved.DepositReceivedAt);
    }
}
