using System.Net;
using System.Text.Json;
using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.CheckoutNotes;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// Ronda 9: <c>GET api/event-requests/{id}/checkout-notes</c>. El cliente del pedido recibe las
/// notas de "cómo pagar"; el handler decide quién puede leerlas (404 para cualquier otro) y el
/// endpoint devuelve la forma fija del contrato y el 404 con su mensaje.
/// </summary>
public class CheckoutNotesEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long RequestId = 42;

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public CheckoutNotesEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;
    }

    private void HandlerReturns(BookingResult<List<CheckoutNoteResponse>> result)
        => _mediator
            .SendQueryAsync<GetEventRequestCheckoutNotesQuery, BookingResult<List<CheckoutNoteResponse>>>(
                Arg.Any<GetEventRequestCheckoutNotesQuery>())
            .Returns(result);

    private static List<CheckoutNoteResponse> Notes() =>
    [
        new()
        {
            Title = "Cómo pagar",
            Body = "Acordaste el pago en efectivo con el grupo. Te atiende Pedro Vargas.",
            UserDescription = "Pagas directo al grupo; NitroGroups no cobra ni interviene."
        },
        new()
        {
            Title = "Instrucciones del grupo",
            Body = "Transfiere a la CLABE 0121 8000 1234 5678.",
            UserDescription = "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
            UpdatedOn = new DateOnly(2026, 11, 5)
        }
    ];

    [Fact]
    public async Task SinToken_Returns401()
    {
        var response = await _anonymous.GetAsync($"api/event-requests/{RequestId}/checkout-notes");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.GetAsync($"api/event-requests/{RequestId}/checkout-notes");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PideLasNotasDelPedidoDeLaRuta_ParaElUsuarioDelToken()
    {
        HandlerReturns(BookingResult<List<CheckoutNoteResponse>>.Success(Notes()));

        var response = await _client.GetAsync($"api/event-requests/{RequestId}/checkout-notes");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received()
            .SendQueryAsync<GetEventRequestCheckoutNotesQuery, BookingResult<List<CheckoutNoteResponse>>>(
                Arg.Is<GetEventRequestCheckoutNotesQuery>(q => q.EventRequestId == RequestId && q.UserId == TestAuthHandler.UserId));
    }

    [Fact]
    public async Task LasDosNotas_ViajanConSuFormaFijaYEnOrden()
    {
        HandlerReturns(BookingResult<List<CheckoutNoteResponse>>.Success(Notes()));

        var response = await _client.GetAsync($"api/event-requests/{RequestId}/checkout-notes");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var notes = json.RootElement.EnumerateArray().ToList();

        Assert.Equal(2, notes.Count);
        Assert.Equal(
            ["title", "body", "userDescription", "updatedOn"],
            notes[0].EnumerateObject().Select(property => property.Name));
        Assert.Equal("Cómo pagar", notes[0].GetProperty("title").GetString());
        Assert.Equal("Acordaste el pago en efectivo con el grupo. Te atiende Pedro Vargas.", notes[0].GetProperty("body").GetString());
        Assert.Equal(
            "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
            notes[0].GetProperty("userDescription").GetString());
        // La nota del acuerdo no tiene fecha: la del acuerdo no se actualiza.
        Assert.Equal(JsonValueKind.Null, notes[0].GetProperty("updatedOn").ValueKind);

        Assert.Equal("Instrucciones del grupo", notes[1].GetProperty("title").GetString());
        Assert.Equal("2026-11-05", notes[1].GetProperty("updatedOn").GetString());
    }

    [Fact]
    public async Task UnPedidoQueElLlamanteNoPuedeLeer_Returns404ConSuMensaje()
    {
        HandlerReturns(BookingResult<List<CheckoutNoteResponse>>.NotFound());

        var response = await _client.GetAsync($"api/event-requests/{RequestId}/checkout-notes");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("Solicitud no encontrada.", await response.Content.ReadAsStringAsync());
    }
}
