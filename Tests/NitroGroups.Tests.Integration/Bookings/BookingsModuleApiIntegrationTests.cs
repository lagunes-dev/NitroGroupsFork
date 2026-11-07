using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Adapters;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// The public Bookings contract answers the only question other modules ask: which of these
/// groups already have an accepted event on this date, so nobody offers them as free.
/// </summary>
public class BookingsModuleApiIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private const long UnknownGroupId = 999;
    private static readonly DateOnly Day = FutureDate;
    private static readonly DateOnly OtherDay = FutureDate.AddDays(1);

    private static BookingsModuleApi Api(BookingsDbContext context) => new(context);

    private static Task<EventRequest> SeedAsync(BookingsDbContext context, long groupId, DateOnly date, EventRequestStatus status)
        => BookingsTestScenario.SeedAsync(context, groupId: groupId, eventDate: date, configure: request => MoveTo(request, status));

    private static void MoveTo(EventRequest request, EventRequestStatus status)
    {
        var now = DateTime.UtcNow;
        switch (status)
        {
            case EventRequestStatus.Accepted:
                request.Accept(null, now);
                break;
            case EventRequestStatus.Declined:
                request.Decline(null, now);
                break;
            case EventRequestStatus.Cancelled:
                request.Cancel(EventRequestParty.Client);
                break;
        }
    }

    [Fact]
    public async Task ReturnsOnlyTheBusyGroupsAmongThoseAsked()
    {
        await using var context = fixture.CreateBookingsContext();
        await SeedAsync(context, GroupId, Day, EventRequestStatus.Accepted);
        await SeedAsync(context, OtherGroupId, Day, EventRequestStatus.Accepted);
        await SeedAsync(context, UnknownGroupId, Day, EventRequestStatus.Accepted); // never asked for

        var busy = await Api(context).GetBusyGroupIdsAsync([GroupId], Day);

        Assert.Equal([GroupId], busy);
        Assert.DoesNotContain(UnknownGroupId, busy);
        Assert.DoesNotContain(OtherGroupId, busy);
    }

    [Fact]
    public async Task NoAcceptedEvent_ReturnsAnEmptySet()
    {
        await using var context = fixture.CreateBookingsContext();
        await SeedAsync(context, UnknownGroupId, Day, EventRequestStatus.Accepted);

        var busy = await Api(context).GetBusyGroupIdsAsync([GroupId, OtherGroupId], Day);

        Assert.Empty(busy);
    }

    [Fact]
    public async Task NoGroupsAsked_ReturnsAnEmptySet()
    {
        await using var context = fixture.CreateBookingsContext();
        await SeedAsync(context, GroupId, Day, EventRequestStatus.Accepted);

        var busy = await Api(context).GetBusyGroupIdsAsync([], Day);

        Assert.Empty(busy);
    }

    [Theory]
    [InlineData(EventRequestStatus.Pending)]
    [InlineData(EventRequestStatus.Declined)]
    [InlineData(EventRequestStatus.Cancelled)]
    public async Task RequestsThatAreNotAcceptedNeverMakeAGroupBusy(EventRequestStatus status)
    {
        await using var context = fixture.CreateBookingsContext();
        await SeedAsync(context, GroupId, Day, status);

        var busy = await Api(context).GetBusyGroupIdsAsync([GroupId], Day);

        Assert.Empty(busy);
    }

    [Fact]
    public async Task AnAcceptedEventOnAnotherDateDoesNotMakeTheGroupBusy()
    {
        await using var context = fixture.CreateBookingsContext();
        await SeedAsync(context, GroupId, OtherDay, EventRequestStatus.Accepted);

        var busy = await Api(context).GetBusyGroupIdsAsync([GroupId], Day);

        Assert.Empty(busy);
    }

    [Fact]
    public async Task TwoAcceptedEventsOnTheSameDayReportTheGroupOnlyOnce()
    {
        await using var context = fixture.CreateBookingsContext();
        await SeedAsync(context, GroupId, Day, EventRequestStatus.Accepted);
        await SeedAsync(context, GroupId, Day, EventRequestStatus.Accepted);

        var busy = await Api(context).GetBusyGroupIdsAsync([GroupId], Day);

        Assert.Equal([GroupId], busy);
    }
}
