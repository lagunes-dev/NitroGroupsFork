using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// Agenda del miembro: <c>GET api/me/gigs</c> y <c>POST api/gigs/{id}/attendance</c>.
/// La identidad sale siempre del token.
/// </summary>
public class GigsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public GigsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;
    }

    private static GigResponse Gig() => new()
    {
        Id = 5,
        GroupId = 10,
        GroupName = "Los Vargas",
        GroupSlug = "los-vargas",
        EventDate = new DateOnly(2026, 12, 12),
        StartTime = new TimeOnly(20, 0),
        DurationHours = 5,
        EventType = "Boda",
        LocationText = "Salón Los Arcos, CDMX",
        Role = "Member",
        Attendance = null
    };

    [Theory]
    [InlineData("GET", "api/me/gigs")]
    [InlineData("POST", "api/gigs/5/attendance")]
    public async Task SinToken_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { status = "Confirmed" }) };

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("GET", "api/me/gigs")]
    [InlineData("POST", "api/gigs/5/attendance")]
    public async Task UsuarioSinSincronizar_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { status = "Confirmed" }) };

        var response = await _unregistered.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MisToques_UsaElUsuarioDelToken_YDevuelveElContratoExacto()
    {
        _mediator.SendQueryAsync<GetMyGigsQuery, List<GigResponse>>(Arg.Any<GetMyGigsQuery>())
            .Returns([Gig()]);

        var response = await _client.GetAsync("api/me/gigs");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetMyGigsQuery, List<GigResponse>>(
            Arg.Is<GetMyGigsQuery>(q => q.UserId == TestAuthHandler.UserId));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var gig = Assert.Single(json.RootElement.EnumerateArray());
        // El orden de las propiedades de un objeto JSON no importa; el conjunto sí.
        Assert.Equal(
            new[] { "id", "groupId", "groupName", "groupSlug", "eventDate", "startTime", "durationHours", "eventType", "locationText", "role", "attendance", "callTime", "setlist", "myPay" }.Order(StringComparer.Ordinal),
            gig.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal));
        Assert.Equal(5, gig.GetProperty("id").GetInt64());
        Assert.Equal(10, gig.GetProperty("groupId").GetInt64());
        Assert.Equal("Los Vargas", gig.GetProperty("groupName").GetString());
        Assert.Equal("los-vargas", gig.GetProperty("groupSlug").GetString());
        Assert.Equal("2026-12-12", gig.GetProperty("eventDate").GetString());
        Assert.Equal("20:00:00", gig.GetProperty("startTime").GetString());
        Assert.Equal(5, gig.GetProperty("durationHours").GetInt32());
        Assert.Equal("Boda", gig.GetProperty("eventType").GetString());
        Assert.Equal("Salón Los Arcos, CDMX", gig.GetProperty("locationText").GetString());
        Assert.Equal("Member", gig.GetProperty("role").GetString());
        Assert.Equal(JsonValueKind.Null, gig.GetProperty("attendance").ValueKind);
    }

    [Fact]
    public async Task MisToques_DevuelveHoraSetlistYMiPago_ConNulosCuandoNoHay()
    {
        var withLogistics = Gig();
        withLogistics.CallTime = new TimeOnly(18, 30);
        withLogistics.Setlist = "Cielito lindo";
        withLogistics.MyPay = 1200m;
        _mediator.SendQueryAsync<GetMyGigsQuery, List<GigResponse>>(Arg.Any<GetMyGigsQuery>())
            .Returns([withLogistics, Gig()]);

        var response = await _client.GetAsync("api/me/gigs");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var rows = json.RootElement.EnumerateArray().ToList();
        Assert.Equal("18:30:00", rows[0].GetProperty("callTime").GetString());
        Assert.Equal("Cielito lindo", rows[0].GetProperty("setlist").GetString());
        Assert.Equal(1200m, rows[0].GetProperty("myPay").GetDecimal());
        Assert.Equal(JsonValueKind.Null, rows[1].GetProperty("callTime").ValueKind);
        Assert.Equal(JsonValueKind.Null, rows[1].GetProperty("setlist").ValueKind);
        Assert.Equal(JsonValueKind.Null, rows[1].GetProperty("myPay").ValueKind);
    }

    [Fact]
    public async Task MisToques_ConRespuesta_DevuelveElEstadoComoTexto()
    {
        var gig = Gig();
        gig.Attendance = "Confirmed";
        _mediator.SendQueryAsync<GetMyGigsQuery, List<GigResponse>>(Arg.Any<GetMyGigsQuery>())
            .Returns([gig]);

        var response = await _client.GetAsync("api/me/gigs");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Confirmed", Assert.Single(json.RootElement.EnumerateArray()).GetProperty("attendance").GetString());
    }

    [Fact]
    public async Task ResponderAsistencia_UsaElUsuarioDelToken_IgnorandoUserIdDelBody()
    {
        _mediator.SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(Arg.Any<SetGigAttendanceCommand>())
            .Returns(BookingResult<GigAttendanceResponse>.Success(new GigAttendanceResponse { Id = 5, Attendance = "Confirmed" }));

        var response = await _client.PostAsJsonAsync("api/gigs/5/attendance", new { status = "Confirmed", userId = 77 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(
            Arg.Is<SetGigAttendanceCommand>(c => c.GigId == 5 && c.UserId == TestAuthHandler.UserId && c.Status == "Confirmed"));
        await _mediator.DidNotReceive().SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(
            Arg.Is<SetGigAttendanceCommand>(c => c.UserId == 77));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(["id", "attendance"], json.RootElement.EnumerateObject().Select(property => property.Name));
        Assert.Equal(5, json.RootElement.GetProperty("id").GetInt64());
        Assert.Equal("Confirmed", json.RootElement.GetProperty("attendance").GetString());
    }

    [Fact]
    public async Task ResponderAsistencia_SinSerMiembro_Returns404()
    {
        _mediator.SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(Arg.Is<SetGigAttendanceCommand>(c => c.GigId == 404))
            .Returns(BookingResult<GigAttendanceResponse>.Failure(BookingErrorKind.NotFound, "Toque no encontrado."));

        var response = await _client.PostAsJsonAsync("api/gigs/404/attendance", new { status = "Confirmed" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("Toque no encontrado.", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ResponderAsistencia_EstadoInvalido_Returns400()
    {
        _mediator.SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(Arg.Any<SetGigAttendanceCommand>())
            .Returns(BookingResult<GigAttendanceResponse>.Failure(BookingErrorKind.Validation, "La asistencia debe ser \"Confirmed\" o \"Declined\"."));

        var response = await _client.PostAsJsonAsync("api/gigs/5/attendance", new { status = "Maybe" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("La asistencia debe ser", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ResponderAsistencia_SinBody_UsaElUsuarioDelToken()
    {
        _mediator.SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(Arg.Any<SetGigAttendanceCommand>())
            .Returns(BookingResult<GigAttendanceResponse>.Failure(BookingErrorKind.Validation, "La asistencia debe ser \"Confirmed\" o \"Declined\"."));

        var response = await _client.PostAsync("api/gigs/5/attendance", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await _mediator.Received().SendCommandAsync<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>(
            Arg.Is<SetGigAttendanceCommand>(c => c.GigId == 5 && c.UserId == TestAuthHandler.UserId && c.Status == null));
    }
}
