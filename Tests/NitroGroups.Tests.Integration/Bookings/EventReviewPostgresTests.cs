using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// Reglas de <c>bookings.event_reviews</c> en la base real: una reseña por evento, calificación
/// de 1 a 5 y comentario de máximo 1000 caracteres, con borrado en cascada del evento.
/// </summary>
public class EventReviewPostgresTests : IClassFixture<IntegrationTestFixture>
{
    private const long ClientId = 3;

    private static BookingsDbContext Context(string cs) =>
        new(new DbContextOptionsBuilder<BookingsDbContext>().UseNpgsql(cs).Options);

    private static async Task<long> SeedPastAcceptedAsync(BookingsDbContext context)
    {
        var request = new EventRequest
        {
            GroupId = 101, ClientUserId = ClientId, EventDate = new DateOnly(2026, 10, 20), DurationHours = 3,
            EventType = "Boda", LocationText = "Salón Los Arcos", Message = "Queremos mariachi en la recepción.",
        };
        request.Accept(null, DateTime.UtcNow);
        request.ClearDomainEvents();
        context.EventRequests.Add(request);
        await context.SaveChangesAsync();
        return request.Id;
    }

    private static EventReview Review(long eventId, int rating = 5, string? comment = "Excelente") => new()
    {
        EventRequestId = eventId,
        ClientUserId = ClientId,
        GroupId = 101,
        Rating = rating,
        Comment = comment
    };

    [PostgresFact]
    public async Task LaTablaNoAdmiteDosResenasDelMismoEvento()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var eventId = await SeedPastAcceptedAsync(ctx);

        ctx.EventReviews.AddRange(Review(eventId, 5), Review(eventId, 4));

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task LaTablaAceptaLosExtremosUnoYCinco()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var primera = await SeedPastAcceptedAsync(ctx);
        var segunda = await SeedPastAcceptedAsync(ctx);

        ctx.EventReviews.AddRange(Review(primera, 1), Review(segunda, 5));
        await ctx.SaveChangesAsync();

        var ratings = ctx.EventReviews.AsNoTracking().Select(r => r.Rating).OrderBy(r => r).ToList();
        Assert.Equal([1, 5], ratings);
    }

    [PostgresFact]
    public async Task LaTablaRechazaLaCalificacionCero()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var eventId = await SeedPastAcceptedAsync(ctx);

        ctx.EventReviews.Add(Review(eventId, 0));

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task LaTablaRechazaLaCalificacionSeis()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var eventId = await SeedPastAcceptedAsync(ctx);

        ctx.EventReviews.Add(Review(eventId, 6));

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task LaTablaRechazaUnComentarioDeMasDe1000Caracteres()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var eventId = await SeedPastAcceptedAsync(ctx);

        ctx.EventReviews.Add(Review(eventId, 5, new string('x', 1001)));

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task AlBorrarElEventoSeVanSusResenas()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var eventId = await SeedPastAcceptedAsync(ctx);
        ctx.EventReviews.Add(Review(eventId));
        await ctx.SaveChangesAsync();

        await ctx.Database.ExecuteSqlAsync($"DELETE FROM bookings.event_requests WHERE id = {eventId}");

        Assert.Empty(ctx.EventReviews.AsNoTracking().ToList());
    }
}
