using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Signals;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// D6: <c>GET api/groups/{groupId}/event-requests/{id}/signals</c>, solo Owner/Manager del grupo.
/// El endpoint traduce el resultado del handler (404 si la solicitud no es de ese grupo) y devuelve
/// la forma fija del contrato: <c>dateClash { clashes, withGig }</c> y
/// <c>budget { offered, baseRate, status }</c>.
/// </summary>
public class EventRequestSignalsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999; // grupo que el usuario de test NO administra
    private const long GroupId = 10;
    private const long RequestId = 42;

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public EventRequestSignalsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
    }

    /// <summary>Lo que el handler devolvería para esta petición.</summary>
    private void HandlerReturns(BookingResult<EventRequestSignalsResponse> result)
        => _mediator
            .SendQueryAsync<GetEventRequestSignalsQuery, BookingResult<EventRequestSignalsResponse>>(
                Arg.Any<GetEventRequestSignalsQuery>())
            .Returns(result);

    private static EventRequestSignalsResponse Response(
        bool clashes = false,
        ClashingGigResponse? withGig = null,
        decimal? offered = null,
        decimal? baseRate = null,
        string status = BudgetSignalResponse.StatusUnknown)
        => new()
        {
            DateClash = new DateClashSignalResponse { Clashes = clashes, WithGig = withGig },
            Budget = new BudgetSignalResponse { Offered = offered, BaseRate = baseRate, Status = status }
        };

    private static BookingResult<EventRequestSignalsResponse> Success(EventRequestSignalsResponse response)
        => BookingResult<EventRequestSignalsResponse>.Success(response);

    [Fact]
    public async Task SinToken_Returns401()
    {
        var response = await _anonymous.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GrupoAjeno_Returns403_SinLlamarAlHandler()
    {
        var response = await _client.GetAsync($"api/groups/{ForeignGroupId}/event-requests/{RequestId}/signals");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive()
            .SendQueryAsync<GetEventRequestSignalsQuery, BookingResult<EventRequestSignalsResponse>>(
                Arg.Is<GetEventRequestSignalsQuery>(q => q.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task Manager_PideLasSenalesDelGrupoYDeLaSolicitudDeLaRuta()
    {
        HandlerReturns(Success(Response()));

        var response = await _client.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received()
            .SendQueryAsync<GetEventRequestSignalsQuery, BookingResult<EventRequestSignalsResponse>>(
                Arg.Is<GetEventRequestSignalsQuery>(q => q.GroupId == GroupId && q.EventRequestId == RequestId));
    }

    [Fact]
    public async Task ChoqueDeFecha_DevuelveElOtroToqueConSuIdTipoDeEventoYLugar()
    {
        HandlerReturns(Success(Response(
            clashes: true,
            withGig: new ClashingGigResponse { Id = 77, EventType = "Boda", LocationText = "Hacienda San Gabriel" },
            offered: 18000m,
            baseRate: 12000m,
            status: BudgetSignalResponse.StatusAbove)));

        var response = await _client.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = json.RootElement;

        Assert.Equal(["dateClash", "budget"], root.EnumerateObject().Select(property => property.Name));

        var clash = root.GetProperty("dateClash");
        Assert.Equal(["clashes", "withGig"], clash.EnumerateObject().Select(property => property.Name));
        Assert.True(clash.GetProperty("clashes").GetBoolean());
        var withGig = clash.GetProperty("withGig");
        // Las horas viajan para que el manager no tenga que abrir la agenda (ronda 5, Mónica).
        Assert.Equal(
            ["id", "eventType", "locationText", "startTime", "durationHours"],
            withGig.EnumerateObject().Select(property => property.Name));
        Assert.Equal(77, withGig.GetProperty("id").GetInt64());
        Assert.Equal("Boda", withGig.GetProperty("eventType").GetString());
        Assert.Equal("Hacienda San Gabriel", withGig.GetProperty("locationText").GetString());

        var budget = root.GetProperty("budget");
        // `currency` viaja con la tarifa base: la del grupo, no la del cliente (S15).
        Assert.Equal(["offered", "baseRate", "currency", "status"], budget.EnumerateObject().Select(property => property.Name));
        Assert.Equal(18000m, budget.GetProperty("offered").GetDecimal());
        Assert.Equal(12000m, budget.GetProperty("baseRate").GetDecimal());
        Assert.Equal("Above", budget.GetProperty("status").GetString());
    }

    [Fact]
    public async Task SinChoque_DevuelveClashesFalseYWithGigNulo()
    {
        HandlerReturns(Success(Response()));

        var response = await _client.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var clash = json.RootElement.GetProperty("dateClash");

        Assert.False(clash.GetProperty("clashes").GetBoolean());
        Assert.Equal(JsonValueKind.Null, clash.GetProperty("withGig").ValueKind);
    }

    [Theory]
    [InlineData(18000, 12000, BudgetSignalResponse.StatusAbove)]
    [InlineData(9000, 12000, BudgetSignalResponse.StatusBelow)]
    [InlineData(12000, 12000, BudgetSignalResponse.StatusEqual)]
    public async Task Presupuesto_ComparaOfrecidoConTarifaBase(int offered, int baseRate, string expected)
    {
        HandlerReturns(Success(Response(offered: offered, baseRate: baseRate, status: expected)));

        var response = await _client.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(expected, json.RootElement.GetProperty("budget").GetProperty("status").GetString());
    }

    [Fact]
    public async Task PresupuestoSinDatos_DevuelveUnknownConLosMontosEnNulo()
    {
        HandlerReturns(Success(Response(status: BudgetSignalResponse.StatusUnknown)));

        var response = await _client.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var budget = json.RootElement.GetProperty("budget");
        Assert.Equal("Unknown", budget.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, budget.GetProperty("offered").ValueKind);
        Assert.Equal(JsonValueKind.Null, budget.GetProperty("baseRate").ValueKind);
    }

    [Fact]
    public async Task SolicitudQueNoEsDeEseGrupo_Returns404()
    {
        HandlerReturns(BookingResult<EventRequestSignalsResponse>.NotFound());

        var response = await _client.GetAsync($"api/groups/{GroupId}/event-requests/{RequestId}/signals");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("Solicitud no encontrada.", await response.Content.ReadAsStringAsync());
    }
}
