using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// El aviso es único por (toque, músico, tipo) y día, y el tipo solo admite los tres del contrato:
/// el índice único y el CHECK de <c>bookings.gig_notices</c> lo garantizan aunque dos peticiones
/// lleguen a la vez.
/// </summary>
public class GigNoticesPostgresTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private const long MemberId = 7;
    private static readonly DateOnly Today = new(2026, 11, 3);

    private static BookingsDbContext Context(string connectionString) =>
        new(new DbContextOptionsBuilder<BookingsDbContext>().UseNpgsql(connectionString).Options);

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

    private static GigNotice Notice(long gigId, GigNoticeKind kind, DateOnly? sentOn = null, long userId = MemberId) => new()
    {
        EventRequestId = gigId,
        UserId = userId,
        Kind = kind,
        SentOn = sentOn ?? Today,
        CreatedBy = userId
    };

    [PostgresFact]
    public async Task LaTablaNoAdmiteDosAvisosDelMismoMusicoTipoYDia()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);

        ctx.GigNotices.AddRange(Notice(gigId, GigNoticeKind.Pay), Notice(gigId, GigNoticeKind.Pay));

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task LaTablaSiAdmiteElMismoTipoEnOtroDiaYOtroTipoElMismoDia()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);

        ctx.GigNotices.AddRange(
            Notice(gigId, GigNoticeKind.Pay),
            Notice(gigId, GigNoticeKind.Pay, Today.AddDays(1)),
            Notice(gigId, GigNoticeKind.Setlist),
            Notice(gigId, GigNoticeKind.Pay, userId: 8));
        await ctx.SaveChangesAsync();

        await using var check = Context(db.ConnectionString);
        Assert.Equal(4, await check.GigNotices.CountAsync());
    }

    [PostgresFact]
    public async Task LaTablaNoAdmiteUnTipoFueraDeLosTresDelContrato()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);

        ctx.GigNotices.Add(Notice(gigId, (GigNoticeKind)0));

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }
}
