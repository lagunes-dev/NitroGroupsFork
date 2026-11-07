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

    // T48 (S18): la migración agrega las dos columnas, nulas por defecto, y se guardan y leen.
    [PostgresFact]
    public async Task LaMigracionAgregaSaldoRecibidoYPagadoComoColumnasNulas()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();

        var columns = await ColumnsAsync(ctx);
        Assert.Contains(("event_requests", "balance_received_at", "timestamp with time zone", "YES"), columns);
        Assert.Contains(("gig_pay", "paid_at", "timestamp with time zone", "YES"), columns);

        var gigId = await SeedAcceptedAsync(ctx);
        ctx.GigPays.Add(new GigPay { EventRequestId = gigId, UserId = MemberId, Amount = 100m });
        await ctx.SaveChangesAsync();

        await using var fresh = Context(db.ConnectionString);
        Assert.Null((await fresh.EventRequests.SingleAsync(r => r.Id == gigId)).BalanceReceivedAt);
        Assert.Null((await fresh.GigPays.SingleAsync(p => p.EventRequestId == gigId)).PaidAt);
    }

    [PostgresFact]
    public async Task ElSaldoRecibidoYLaFechaDePagoSeGuardanYSeLeen()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);
        var when = new DateTime(2026, 12, 13, 15, 0, 0, DateTimeKind.Utc);

        var gig = await ctx.EventRequests.SingleAsync(r => r.Id == gigId);
        gig.SetBalanceReceived(true, when);
        ctx.GigPays.Add(new GigPay { EventRequestId = gigId, UserId = MemberId, Amount = 100m, PaidAt = when });
        await ctx.SaveChangesAsync();

        await using var check = Context(db.ConnectionString);
        Assert.Equal(when, (await check.EventRequests.SingleAsync(r => r.Id == gigId)).BalanceReceivedAt);
        Assert.Equal(when, (await check.GigPays.SingleAsync(p => p.EventRequestId == gigId)).PaidAt);
    }

    private static async Task<List<(string Table, string Column, string Type, string Nullable)>> ColumnsAsync(BookingsDbContext ctx)
    {
        var rows = new List<(string, string, string, string)>();
        await using var command = ctx.Database.GetDbConnection().CreateCommand();
        command.CommandText = """
            select table_name, column_name, data_type, is_nullable from information_schema.columns
            where table_schema = 'bookings' and column_name in ('balance_received_at', 'paid_at')
            """;
        if (command.Connection!.State != System.Data.ConnectionState.Open)
            await command.Connection.OpenAsync();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
            rows.Add((reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3)));
        return rows;
    }
}
