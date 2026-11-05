using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Cancel;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Respond;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Abstractions.Repository;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// Regresión del bloqueante B1 del verificador: sin control de concurrencia, aceptar y rechazar
/// a la vez dejaban la solicitud rechazada después de avisar "aceptó" al cliente.
/// </summary>
public class EventRequestConcurrencyPostgresTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private const long GroupId = 101;

    private static BookingsDbContext Context(string cs) =>
        new(new DbContextOptionsBuilder<BookingsDbContext>().UseNpgsql(cs).Options);

    private static async Task<long> SeedPendingAsync(string cs)
    {
        await using var ctx = Context(cs);
        var request = new EventRequest
        {
            GroupId = GroupId, ClientUserId = 3, EventDate = new DateOnly(2027, 1, 15), DurationHours = 3,
            EventType = "Boda", LocationText = "Salón Los Arcos", Message = "Queremos mariachi en la recepción.",
        };
        ctx.EventRequests.Add(request);
        await ctx.SaveChangesAsync();
        return request.Id;
    }

    [PostgresFact]
    public async Task DosGuardadosSobreLaMismaVersion_ElSegundoEsConflicto()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using (var ctx = Context(db.ConnectionString)) await ctx.Database.MigrateAsync();
        var id = await SeedPendingAsync(db.ConnectionString);

        await using var a = Context(db.ConnectionString);
        await using var b = Context(db.ConnectionString);
        var ra = await a.EventRequests.SingleAsync(r => r.Id == id);
        var rb = await b.EventRequests.SingleAsync(r => r.Id == id);

        ra.Accept(null, DateTime.UtcNow);
        rb.Decline(null, DateTime.UtcNow);
        await fixture.CreateBookingsUnitOfWork(a).CompleteAsync();

        await Assert.ThrowsAsync<ConcurrencyConflictException>(() => fixture.CreateBookingsUnitOfWork(b).CompleteAsync());

        await using var check = Context(db.ConnectionString);
        Assert.Equal(Shared.Domain.DomainEvents.Bookings.Enums.EventRequestStatus.Accepted,
            (await check.EventRequests.SingleAsync(r => r.Id == id)).Status);
    }

    [PostgresFact]
    public async Task AceptarYRechazarALaVez_SoloUnoGana_YHayUnSoloEventoDeEstado()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using (var ctx = Context(db.ConnectionString)) await ctx.Database.MigrateAsync();

        var groups = Substitute.For<IGroupsModuleApi>();
        groups.CanManageGroupAsync(GroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(true);
        groups.GetGroupAsync(GroupId, Arg.Any<CancellationToken>())
            .Returns(new GroupSummary(GroupId, "grupo", "Grupo", "g@x.com", 1, true, null));
        groups.GetGroupsAsync(Arg.Any<IEnumerable<long>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<long, GroupSummary> { [GroupId] = new(GroupId, "grupo", "Grupo", "g@x.com", 1, true, null) });
        var users = Substitute.For<IUsersModuleApi>();
        users.GetUsersAsync(Arg.Any<IEnumerable<long>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<long, UserSummary>());

        for (var i = 0; i < 10; i++)
        {
            var id = await SeedPendingAsync(db.ConnectionString);

            async Task<BookingResult<Shared.Contracts.Bookings.Responses.EventRequestResponse>> Respond(long userId, EventRequestDecision decision)
            {
                await using var ctx = Context(db.ConnectionString);
                var uow = fixture.CreateBookingsUnitOfWork(ctx, fixture.CreateBookingsOutbox(ctx));
                return await new RespondToEventRequestCommandHandler(uow, groups, users, TimeProvider.System)
                    .Handle(new RespondToEventRequestCommand(id, userId, decision, null), default);
            }

            var results = await Task.WhenAll(Respond(1, EventRequestDecision.Accept), Respond(6, EventRequestDecision.Decline));

            Assert.Single(results, r => r.IsSuccess);
            Assert.Single(results, r => !r.IsSuccess && r.ErrorKind == BookingErrorKind.Conflict);

            await using var check = Context(db.ConnectionString);
            var statusEvents = await check.OutboxEvents.CountAsync(e => e.EventData.Contains($"\"EventRequestId\":{id},"));
            Assert.Equal(1, statusEvents); // (la semilla no emite "created": solo cuenta el cambio de estado)
        }
    }

    [PostgresFact]
    public async Task CancelarYAceptarALaVez_SoloUnoGana()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using (var ctx = Context(db.ConnectionString)) await ctx.Database.MigrateAsync();

        var groups = Substitute.For<IGroupsModuleApi>();
        groups.CanManageGroupAsync(GroupId, 1, Arg.Any<CancellationToken>()).Returns(true);
        groups.GetGroupAsync(GroupId, Arg.Any<CancellationToken>()).Returns(new GroupSummary(GroupId, "grupo", "Grupo", "g@x.com", 1, true, null));
        groups.GetGroupsAsync(Arg.Any<IEnumerable<long>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<long, GroupSummary> { [GroupId] = new(GroupId, "grupo", "Grupo", "g@x.com", 1, true, null) });
        var users = Substitute.For<IUsersModuleApi>();
        users.GetUsersAsync(Arg.Any<IEnumerable<long>>(), Arg.Any<CancellationToken>()).Returns(new Dictionary<long, UserSummary>());

        for (var i = 0; i < 10; i++)
        {
            var id = await SeedPendingAsync(db.ConnectionString);

            async Task<bool> Accept()
            {
                await using var ctx = Context(db.ConnectionString);
                var uow = fixture.CreateBookingsUnitOfWork(ctx, fixture.CreateBookingsOutbox(ctx));
                return (await new RespondToEventRequestCommandHandler(uow, groups, users, TimeProvider.System)
                    .Handle(new RespondToEventRequestCommand(id, 1, EventRequestDecision.Accept, null), default)).IsSuccess;
            }

            async Task<bool> Cancel()
            {
                await using var ctx = Context(db.ConnectionString);
                var uow = fixture.CreateBookingsUnitOfWork(ctx, fixture.CreateBookingsOutbox(ctx));
                var result = await new CancelEventRequestCommandHandler(uow, groups, users, TimeProvider.System)
                    .Handle(new CancelEventRequestCommand(id, 3), default); // 3 = el cliente de la semilla
                Assert.True(result.IsSuccess || result.ErrorKind == BookingErrorKind.Conflict, result.Error);
                return result.IsSuccess;
            }

            var results = await Task.WhenAll(Accept(), Cancel());

            await using var check = Context(db.ConnectionString);
            var events = await check.OutboxEvents.CountAsync(e => e.EventData.Contains($"\"EventRequestId\":{id},"));
            // Aceptar y luego cancelar es una secuencia válida (2 eventos); lo que no puede pasar es
            // que ambos guarden sobre la misma versión y se pierda una transición.
            Assert.Equal(results.Count(ok => ok), events);
        }
    }
}
