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
/// Ronda 9: <c>GET api/event-requests/{id}/checkout-notes</c>. El cliente del pedido recibe la
/// nota de "cómo pagar"; el handler decide quién puede leerla (404 para cualquier otro) y el
/// endpoint devuelve la forma fija del contrato y el 404 con su mensaje. Ronda 10: la respuesta es
/// <b>una</b> nota autoritativa con el nombre del manager en su propia línea.
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
            Body = "Transfiere a la CLABE 0121 8000 1234 5678.",
            ManagerLine = "Te atiende Pedro Vargas.",
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
    public async Task LaNota_ViajaConSuFormaFija()
    {
        HandlerReturns(BookingResult<List<CheckoutNoteResponse>>.Success(Notes()));

        var response = await _client.GetAsync($"api/event-requests/{RequestId}/checkout-notes");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var notes = json.RootElement.EnumerateArray().ToList();

        var note = Assert.Single(notes);
        Assert.Equal(
            ["title", "body", "managerLine", "userDescription", "updatedOn"],
            note.EnumerateObject().Select(property => property.Name));
        Assert.Equal("Cómo pagar", note.GetProperty("title").GetString());
        Assert.Equal("Transfiere a la CLABE 0121 8000 1234 5678.", note.GetProperty("body").GetString());
        Assert.Equal("Te atiende Pedro Vargas.", note.GetProperty("managerLine").GetString());
        Assert.Equal(
            "Pagas directo al grupo; NitroGroups no cobra ni interviene.",
            note.GetProperty("userDescription").GetString());
        Assert.Equal("2026-11-05", note.GetProperty("updatedOn").GetString());
    }

    [Fact]
    public async Task UnaNotaSinManager_ViajaConLaLineaEnNuloYNuncaConCorreo()
    {
        HandlerReturns(BookingResult<List<CheckoutNoteResponse>>.Success(
        [
            new()
            {
                Title = "Cómo pagar",
                Body = "Acuerdas el pago con el grupo.",
                UserDescription = "Pagas directo al grupo; NitroGroups no cobra ni interviene."
            }
        ]));

        var response = await _client.GetAsync($"api/event-requests/{RequestId}/checkout-notes");

        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);
        var note = json.RootElement[0];

        // Sin nombre legible la línea es nula y no se dibuja; el correo del manager no viaja nunca.
        Assert.Equal(JsonValueKind.Null, note.GetProperty("managerLine").ValueKind);
        Assert.DoesNotContain("@", body);
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
