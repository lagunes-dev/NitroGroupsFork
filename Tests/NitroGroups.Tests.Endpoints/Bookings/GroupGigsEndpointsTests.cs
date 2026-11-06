using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// Panel del manager: <c>GET api/groups/{groupId}/gigs</c> exige Owner/Manager del grupo y
/// devuelve las mismas filas más los asistentes, con nombre y sin email.
/// </summary>
public class GroupGigsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999; // grupo que el usuario de test NO administra

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public GroupGigsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
    }

    [Fact]
    public async Task SinToken_Returns401()
    {
        var response = await _anonymous.GetAsync("api/groups/1/gigs");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.GetAsync("api/groups/1/gigs");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GrupoAjeno_Returns403()
    {
        var response = await _client.GetAsync($"api/groups/{ForeignGroupId}/gigs");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendQueryAsync<GetGroupGigsQuery, List<GroupGigResponse>>(
            Arg.Is<GetGroupGigsQuery>(q => q.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task Manager_VeLasMismasFilasMasLosAsistentesSinEmail()
    {
        _mediator.SendQueryAsync<GetGroupGigsQuery, List<GroupGigResponse>>(Arg.Any<GetGroupGigsQuery>())
            .Returns([
                new GroupGigResponse
                {
                    Id = 5, GroupId = 10, GroupName = "Los Vargas", GroupSlug = "los-vargas",
                    EventDate = new DateOnly(2026, 12, 12), StartTime = new TimeOnly(20, 0), DurationHours = 5,
                    EventType = "Boda", LocationText = "Salón Los Arcos, CDMX", Role = "Manager", Attendance = "Confirmed",
                    Attendees = [new GigAttendeeResponse { UserId = 400, FullName = "Mateo Ruiz", Status = "Confirmed" }]
                }
            ]);

        var response = await _client.GetAsync("api/groups/10/gigs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetGroupGigsQuery, List<GroupGigResponse>>(
            Arg.Is<GetGroupGigsQuery>(q => q.GroupId == 10 && q.CallerUserId == TestAuthHandler.UserId));

        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("@", body); // nunca emails
        using var json = JsonDocument.Parse(body);
        var gig = Assert.Single(json.RootElement.EnumerateArray());
        // El orden de las propiedades de un objeto JSON no importa; el conjunto sí.
        Assert.Equal(
            new[] { "id", "groupId", "groupName", "groupSlug", "eventDate", "startTime", "durationHours", "eventType", "locationText", "role", "attendance", "attendees", "setlist", "callTime", "deposit", "balanceReceivedAt" }.Order(StringComparer.Ordinal),
            gig.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
        Assert.Equal("Confirmed", gig.GetProperty("attendance").GetString());
        var attendee = Assert.Single(gig.GetProperty("attendees").EnumerateArray());
        Assert.Equal(["userId", "fullName", "status", "pay", "paidAt"], attendee.EnumerateObject().Select(property => property.Name));
        Assert.Equal(400, attendee.GetProperty("userId").GetInt64());
        Assert.Equal("Mateo Ruiz", attendee.GetProperty("fullName").GetString());
        Assert.Equal("Confirmed", attendee.GetProperty("status").GetString());
    }

    // T59 (S22): el teléfono del manager y los compañeros del toque viajan SOLO en la agenda del
    // músico. La fila del manager conserva exactamente el conjunto de siempre.
    [Fact]
    public async Task Manager_LaFilaDelPanelNoLlevaTelefonoNiCompaneros()
    {
        _mediator.SendQueryAsync<GetGroupGigsQuery, List<GroupGigResponse>>(Arg.Any<GetGroupGigsQuery>())
            .Returns([
                new GroupGigResponse
                {
                    Id = 5, GroupId = 10, GroupName = "Los Vargas", GroupSlug = "los-vargas",
                    EventDate = new DateOnly(2026, 12, 12), StartTime = new TimeOnly(20, 0), DurationHours = 5,
                    EventType = "Boda", LocationText = "Salón Los Arcos, CDMX", Role = "Manager",
                    Attendees = [new GigAttendeeResponse { UserId = 400, FullName = "Mateo Ruiz", Status = "Confirmed" }]
                }
            ]);

        var response = await _client.GetAsync("api/groups/10/gigs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("managerPhone", body);
        Assert.DoesNotContain("teammates", body);
        Assert.DoesNotContain("@", body);
        using var json = JsonDocument.Parse(body);
        var gig = Assert.Single(json.RootElement.EnumerateArray());
        Assert.Equal(
            new[] { "id", "groupId", "groupName", "groupSlug", "eventDate", "startTime", "durationHours", "eventType", "locationText", "role", "attendance", "attendees", "setlist", "callTime", "deposit", "balanceReceivedAt" }.Order(StringComparer.Ordinal),
            gig.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task SinToques_DevuelveListaVacia()
    {
        _mediator.SendQueryAsync<GetGroupGigsQuery, List<GroupGigResponse>>(Arg.Any<GetGroupGigsQuery>())
            .Returns([]);

        var response = await _client.GetAsync("api/groups/10/gigs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }
}
