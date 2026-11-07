using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// La respuesta de asistencia es única por (toque, usuario) a nivel de base de datos: el índice
/// único de <c>bookings.gig_attendance</c> lo garantiza, no solo el upsert del caso de uso.
/// </summary>
public class GigAttendancePostgresTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private const long GroupId = 101;
    private const long MemberId = 7;

    private static BookingsDbContext Context(string cs) =>
        new(new DbContextOptionsBuilder<BookingsDbContext>().UseNpgsql(cs).Options);

    private static async Task<long> SeedAcceptedAsync(BookingsDbContext context)
    {
        var request = new EventRequest
        {
            GroupId = GroupId, ClientUserId = 3, EventDate = new DateOnly(2027, 1, 15), DurationHours = 3,
            EventType = "Boda", LocationText = "Salón Los Arcos", Message = "Queremos mariachi en la recepción.",
        };
        request.Accept(null, DateTime.UtcNow);
        request.ClearDomainEvents();
        context.EventRequests.Add(request);
        await context.SaveChangesAsync();
        return request.Id;
    }

    [PostgresFact]
    public async Task LaTablaNoAdmiteDosRespuestasDelMismoMiembroAlMismoToque()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        await using var ctx = Context(db.ConnectionString);
        await ctx.Database.MigrateAsync();
        var gigId = await SeedAcceptedAsync(ctx);

        ctx.GigAttendances.AddRange(
            new GigAttendance { EventRequestId = gigId, UserId = MemberId, Status = GigAttendanceStatus.Confirmed },
            new GigAttendance { EventRequestId = gigId, UserId = MemberId, Status = GigAttendanceStatus.Declined });

        await Assert.ThrowsAsync<DbUpdateException>(() => ctx.SaveChangesAsync());
    }

    [PostgresFact]
    public async Task ResponderDosVeces_DejaUnaSolaFilaEnPostgres()
    {
        await using var db = await PostgresTestDatabase.CreateAsync();
        long gigId;
        await using (var seed = Context(db.ConnectionString))
        {
            await seed.Database.MigrateAsync();
            gigId = await SeedAcceptedAsync(seed);
        }

        var groups = Substitute.For<IGroupsModuleApi>();
        groups.GetUserGroupMembershipsAsync(MemberId, Arg.Any<CancellationToken>())
            .Returns([new GroupMembershipSummary { GroupId = GroupId, GroupName = "Grupo", Slug = "grupo", Role = GroupMemberRole.Member }]);

        async Task Answer(string status)
        {
            await using var ctx = Context(db.ConnectionString);
            var result = await new SetGigAttendanceCommandHandler(fixture.CreateBookingsUnitOfWork(ctx), groups)
                .Handle(new SetGigAttendanceCommand(gigId, MemberId, status), CancellationToken.None);
            Assert.True(result.IsSuccess, result.Error);
        }

        await Answer("Confirmed");
        await Answer("Declined");

        await using var check = Context(db.ConnectionString);
        var saved = Assert.Single(await check.GigAttendances.Where(a => a.EventRequestId == gigId).ToListAsync());
        Assert.Equal(GigAttendanceStatus.Declined, saved.Status);
    }
}
