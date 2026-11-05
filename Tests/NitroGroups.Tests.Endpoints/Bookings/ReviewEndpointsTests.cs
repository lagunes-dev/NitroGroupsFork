using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Reviews;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Text;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// D7: <c>POST api/event-requests/{id}/review</c>, autenticado y con el cliente del token.
/// 400 para una calificación fuera de 1..5 o un comentario largo; 409/404 según el handler.
/// </summary>
public class ReviewEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    /// <summary>Evento que solo usan los tests de 400: así "el handler no se llamó" no ve otras pruebas.</summary>
    private const long InvalidBodyEventId = 950;

    public ReviewEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;
    }

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    [Fact]
    public async Task SinToken_Returns401()
    {
        var response = await _anonymous.PostAsync("api/event-requests/5/review", Json("{\"rating\":5}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.PostAsync("api/event-requests/5/review", Json("{\"rating\":5}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("{\"rating\":0}")]
    [InlineData("{\"rating\":6}")]
    [InlineData("{}")]
    [InlineData("{\"comment\":\"sin calificación\"}")]
    public async Task CalificacionFueraDeRangoOFaltante_Returns400_SinLlamarAlHandler(string json)
    {
        var response = await _client.PostAsync($"api/event-requests/{InvalidBodyEventId}/review", Json(json));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("La calificación debe estar entre 1 y 5.", await response.Content.ReadAsStringAsync());
        await _mediator.DidNotReceive().SendCommandAsync<PostEventReviewCommand, BookingResult<EventReviewResponse>>(
            Arg.Is<PostEventReviewCommand>(c => c.EventRequestId == InvalidBodyEventId));
    }

    [Fact]
    public async Task ComentarioDeMasDe1000Caracteres_Returns400_SinLlamarAlHandler()
    {
        var body = JsonSerializer.Serialize(new { rating = 5, comment = new string('x', 1001) });

        var response = await _client.PostAsync($"api/event-requests/{InvalidBodyEventId}/review", Json(body));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("El comentario no puede pasar de 1000 caracteres.", await response.Content.ReadAsStringAsync());
        await _mediator.DidNotReceive().SendCommandAsync<PostEventReviewCommand, BookingResult<EventReviewResponse>>(
            Arg.Is<PostEventReviewCommand>(c => c.EventRequestId == InvalidBodyEventId));
    }

    [Fact]
    public async Task Crear_UsaElUsuarioDelToken_YDevuelveLaResena()
    {
        PostEventReviewCommand? sent = null;
        _mediator.SendCommandAsync<PostEventReviewCommand, BookingResult<EventReviewResponse>>(Arg.Do<PostEventReviewCommand>(c => sent = c))
            .Returns(BookingResult<EventReviewResponse>.Success(new EventReviewResponse
            {
                Rating = 5, Comment = "Excelente", CreatedAt = new DateTime(2026, 10, 21, 18, 0, 0, DateTimeKind.Utc)
            }));

        var response = await _client.PostAsync("api/event-requests/5/review",
            Json("{\"rating\":5,\"comment\":\"Excelente\",\"clientUserId\":77}"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("api/event-requests/5", response.Headers.Location?.OriginalString);
        Assert.NotNull(sent);
        Assert.Equal(5L, sent.EventRequestId);
        Assert.Equal(TestAuthHandler.UserId, sent.ClientUserId);
        Assert.Equal(5, sent.Rating);
        Assert.Equal("Excelente", sent.Comment);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var review = json.RootElement;
        Assert.Equal(["rating", "comment", "createdAt"], review.EnumerateObject().Select(p => p.Name));
        Assert.Equal(5, review.GetProperty("rating").GetInt32());
        Assert.Equal("Excelente", review.GetProperty("comment").GetString());
        Assert.Equal("2026-10-21T18:00:00Z", review.GetProperty("createdAt").GetString());
    }

    [Theory]
    [InlineData(BookingErrorKind.Conflict, HttpStatusCode.Conflict, "Todavía no puedes reseñar este evento: la fecha aún no ha pasado.")]
    [InlineData(BookingErrorKind.Conflict, HttpStatusCode.Conflict, "Ya escribiste una reseña para este evento.")]
    [InlineData(BookingErrorKind.NotFound, HttpStatusCode.NotFound, "Solicitud no encontrada.")]
    public async Task Crear_TraduceLosErroresDelHandler(BookingErrorKind kind, HttpStatusCode expected, string message)
    {
        _mediator.SendCommandAsync<PostEventReviewCommand, BookingResult<EventReviewResponse>>(Arg.Any<PostEventReviewCommand>())
            .Returns(BookingResult<EventReviewResponse>.Failure(kind, message));

        var response = await _client.PostAsync("api/event-requests/8/review", Json("{\"rating\":4}"));

        Assert.Equal(expected, response.StatusCode);
        Assert.Contains(message, await response.Content.ReadAsStringAsync());
    }
}
