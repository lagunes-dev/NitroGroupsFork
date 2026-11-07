using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// S2 y S4: el panel del manager (<c>GET api/groups/{groupId}/gigs</c>) muestra los toques de su
/// grupo con las respuestas de los miembros y sus nombres.
/// </summary>
public class GroupGigAgendaQueryHandlersIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public GroupGigAgendaQueryHandlersIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    private GetGroupGigsQueryHandler Handler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);

    private async Task AnswerAsync(BookingsDbContext context, EventRequest gig, long userId, string status)
        => await new SetGigAttendanceCommandHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups)
            .Handle(new SetGigAttendanceCommand(gig.Id, userId, status), CancellationToken.None);

    [Fact]
    public async Task PanelDelGrupo_DevuelveLosToquesDelGrupoConSusAsistentesYNombres()
    {
        await using var context = _fixture.CreateBookingsContext();
        var primero = await SeedGigAsync(context, eventDate: new DateOnly(2026, 11, 20), startTime: new TimeOnly(18, 0));
        var segundo = await SeedGigAsync(context, eventDate: new DateOnly(2026, 12, 12), startTime: new TimeOnly(20, 0));
        var ajeno = await SeedGigAsync(context, groupId: OtherGroupId);

        await AnswerAsync(context, primero, MemberId, "Confirmed");
        await AnswerAsync(context, primero, OtherMemberId, "Declined");
        await AnswerAsync(context, ajeno, MemberId, "Confirmed");

        var result = await Handler(context).Handle(new GetGroupGigsQuery(GroupId, ManagerId), CancellationToken.None);

        Assert.Equal([primero.Id, segundo.Id], result.Select(g => g.Id));
        Assert.All(result, gig => Assert.Equal("Manager", gig.Role)); // el rol del llamante
        Assert.All(result, gig => Assert.Equal("Los Vargas", gig.GroupName));
        Assert.All(result, gig => Assert.Equal("los-vargas", gig.GroupSlug));
        Assert.Null(result[0].Attendance); // el manager no ha respondido
        Assert.Empty(result[1].Attendees);

        var attendees = result[0].Attendees;
        Assert.Equal(
            [(MemberId, "Mateo Ruiz", "Confirmed"), (OtherMemberId, "Sofía Nava", "Declined")],
            attendees.Select(a => (a.UserId, a.FullName, a.Status)));
    }

    [Fact]
    public async Task PanelDelGrupo_SoloVeLosToquesDeEseGrupo()
    {
        await using var context = _fixture.CreateBookingsContext();
        var propio = await SeedGigAsync(context);
        await SeedGigAsync(context, groupId: OtherGroupId);

        var result = await Handler(context).Handle(new GetGroupGigsQuery(GroupId, ManagerId), CancellationToken.None);

        Assert.Equal([propio.Id], result.Select(g => g.Id));
    }

    [Fact]
    public async Task PanelDelGrupo_SinToques_DevuelveListaVacia()
    {
        await using var context = _fixture.CreateBookingsContext();

        var result = await Handler(context).Handle(new GetGroupGigsQuery(GroupId, ManagerId), CancellationToken.None);

        Assert.Empty(result);
    }
}
