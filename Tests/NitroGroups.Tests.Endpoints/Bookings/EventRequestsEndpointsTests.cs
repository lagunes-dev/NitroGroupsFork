using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Cancel;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Create;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Get;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.List;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Messages;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Respond;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>Solicitudes de evento (S10): autenticación, identidad desde el token y permisos.</summary>
public class EventRequestsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999; // grupo que el usuario de test NO administra

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public EventRequestsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
    }

    private static object ValidBody() => new
    {
        groupId = 1,
        eventDate = "2026-12-12",
        startTime = "20:00:00",
        durationHours = 5,
        eventType = "Boda",
        locationText = "Salón Los Arcos, CDMX",
        guestCount = 150,
        budget = 25000,
        message = "Buscamos mariachi para la entrada y el vals.",
    };

    private static BookingResult<EventRequestResponse> Ok(long id = 42) =>
        BookingResult<EventRequestResponse>.Success(new EventRequestResponse { Id = id, GroupId = 1, Status = EventRequestStatus.Pending });

    [Theory]
    [InlineData("POST", "api/event-requests")]
    [InlineData("GET", "api/event-requests/mine")]
    [InlineData("GET", "api/groups/1/event-requests")]
    [InlineData("GET", "api/event-requests/5")]
    [InlineData("POST", "api/event-requests/5/accept")]
    [InlineData("POST", "api/event-requests/5/decline")]
    [InlineData("POST", "api/event-requests/5/cancel")]
    [InlineData("POST", "api/event-requests/5/messages")]
    public async Task SinToken_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("POST", "api/event-requests")]
    [InlineData("GET", "api/event-requests/mine")]
    [InlineData("GET", "api/event-requests/5")]
    [InlineData("POST", "api/event-requests/5/accept")]
    [InlineData("POST", "api/event-requests/5/cancel")]
    [InlineData("POST", "api/event-requests/5/messages")]
    public async Task UsuarioSinSincronizar_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(ValidBody()) };

        var response = await _unregistered.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Crear_ElClienteSaleDelToken_IgnorandoUserIdDelBody()
    {
        _mediator.SendCommandAsync<CreateEventRequestCommand, BookingResult<EventRequestResponse>>(Arg.Any<CreateEventRequestCommand>())
            .Returns(Ok());

        var response = await _client.PostAsJsonAsync("api/event-requests", new
        {
            userId = 77,
            clientUserId = 77,
            groupId = 1,
            eventDate = "2026-12-12",
            durationHours = 5,
            eventType = "Boda",
            locationText = "Salón Los Arcos, CDMX",
            message = "Buscamos mariachi para la entrada y el vals.",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("api/event-requests/42", response.Headers.Location?.OriginalString);
        await _mediator.Received().SendCommandAsync<CreateEventRequestCommand, BookingResult<EventRequestResponse>>(
            Arg.Is<CreateEventRequestCommand>(c => c.ClientUserId == TestAuthHandler.UserId && c.GroupId == 1
                && c.EventDate == new DateOnly(2026, 12, 12) && c.DurationHours == 5));
        await _mediator.DidNotReceive().SendCommandAsync<CreateEventRequestCommand, BookingResult<EventRequestResponse>>(
            Arg.Is<CreateEventRequestCommand>(c => c.ClientUserId == 77));
    }

    [Theory]
    [InlineData("durationHours", 0)]
    [InlineData("durationHours", 13)]
    [InlineData("message", "corto")]
    [InlineData("locationText", "")]
    [InlineData("eventType", "")]
    public async Task Crear_DatosInvalidos_Returns400(string field, object value)
    {
        var body = JsonSerializer.SerializeToNode(ValidBody(), ApiJsonOptions.Default)!.AsObject();
        body[field] = JsonSerializer.SerializeToNode(value);

        var response = await _client.PostAsJsonAsync("api/event-requests", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(problem.RootElement.GetProperty("errors").TryGetProperty(char.ToUpperInvariant(field[0]) + field[1..], out _));
    }

    [Fact]
    public async Task Crear_ConflictoDelCasoDeUso_Returns409ConMensajeEnEspanol()
    {
        _mediator.SendCommandAsync<CreateEventRequestCommand, BookingResult<EventRequestResponse>>(Arg.Any<CreateEventRequestCommand>())
            .Returns(BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Conflict, "El grupo no está disponible en esa fecha."));

        var response = await _client.PostAsJsonAsync("api/event-requests", ValidBody());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("El grupo no está disponible en esa fecha.", await response.Content.ReadAsStringAsync());
    }

    /// <summary>Un renglón con todos los campos del contrato, como lo arma el handler.</summary>
    private static EventRequestResponse Row(long id = 3) => new()
    {
        Id = id,
        GroupId = 1,
        GroupName = "Los Vargas",
        GroupSlug = "los-vargas",
        ClientName = "Ana L.",
        EventDate = new DateOnly(2026, 12, 12),
        StartTime = new TimeOnly(21, 0),
        DurationHours = 3,
        EventType = "Boda",
        LocationText = "Salón Los Arcos, CDMX",
        GuestCount = 150,
        Budget = 25000m,
        Currency = "MXN",
        Message = "Buscamos mariachi para la entrada y el vals.",
        Status = EventRequestStatus.Pending,
        IsSelfBooked = false,
        CreatedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
        RespondedAt = null,
        ResponseMessage = null,
        Deposit = new GigDepositResponse(),
        CanReview = false,
        Review = null,
        Messages = null
    };

    private static DateClashSignalResponse Clash() => new()
    {
        Clashes = true,
        WithGig = new ClashingGigResponse
        {
            Id = 77,
            EventType = "Boda",
            LocationText = "Hacienda San Gabriel",
            StartTime = "20:00",
            DurationHours = 2
        }
    };

    /// <summary>Los campos de siempre, en su orden.</summary>
    private static readonly string[] LegacyKeys =
    [
        "id", "groupId", "groupName", "groupSlug", "clientName", "eventDate", "startTime",
        "durationHours", "eventType", "locationText", "guestCount", "budget", "currency",
        "message", "status", "isSelfBooked", "createdAt", "respondedAt", "responseMessage",
        "deposit", "canReview", "review", "messages"
    ];

    // T29: la bandeja del grupo avisa del choque sin abrir el hilo (S11).
    [Fact]
    public async Task BandejaDelGrupo_LaFilaAvisaDelChoqueYConservaLosCamposDeSiempreEnSuOrden()
    {
        var row = Row();
        row.DateClash = Clash();
        _mediator.SendQueryAsync<GetGroupEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetGroupEventRequestsQuery>())
            .Returns([row]);

        var response = await _client.GetAsync("api/groups/1/event-requests");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var item = json.RootElement[0];

        // El campo nuevo entra al final: los de siempre no se movieron ni se perdieron.
        Assert.Equal([.. LegacyKeys, "balanceReceivedAt", "balanceDueDate", "dateClash"], item.EnumerateObject().Select(property => property.Name));

        var clash = item.GetProperty("dateClash");
        Assert.True(clash.GetProperty("clashes").GetBoolean());
        var withGig = clash.GetProperty("withGig");
        Assert.Equal(77, withGig.GetProperty("id").GetInt64());
        Assert.Equal("Boda", withGig.GetProperty("eventType").GetString());
        Assert.Equal("Hacienda San Gabriel", withGig.GetProperty("locationText").GetString());
        // Con horas, la fila puede decir "se pisa 2 h con Boda 20:00".
        Assert.Equal("20:00", withGig.GetProperty("startTime").GetString());
        Assert.Equal(2, withGig.GetProperty("durationHours").GetInt32());
    }

    [Fact]
    public async Task BandejaDelGrupo_FilaSinChoque_NoLlevaElObjetoDelChoque()
    {
        _mediator.SendQueryAsync<GetGroupEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetGroupEventRequestsQuery>())
            .Returns([Row()]);

        var response = await _client.GetAsync("api/groups/1/event-requests");

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var item = json.RootElement[0];

        // Sin choque el hecho es null, y un null no viaja: la fila queda como siempre.
        Assert.False(item.TryGetProperty("dateClash", out _));
        Assert.Equal([.. LegacyKeys, "balanceReceivedAt", "balanceDueDate"], item.EnumerateObject().Select(property => property.Name));
    }

    // T29: el cliente nunca ve si el grupo está ocupado.
    [Fact]
    public async Task Mias_LaFilaDelClienteNoLlevaElCampoDelChoque()
    {
        _mediator.SendQueryAsync<GetMyEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetMyEventRequestsQuery>())
            .Returns([Row()]);

        var response = await _client.GetAsync("api/event-requests/mine");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var item = json.RootElement[0];

        // El contrato del cliente no cambia en absoluto: ni el campo ni el objeto.
        Assert.False(item.TryGetProperty("dateClash", out _));
        Assert.DoesNotContain("dateClash", await response.Content.ReadAsStringAsync());
        // T48: lo único nuevo es el saldo recibido, al final de los campos de siempre.
        Assert.Equal([.. LegacyKeys, "balanceReceivedAt", "balanceDueDate"], item.EnumerateObject().Select(property => property.Name));
    }

    // T48 (S18): el cliente ve cuándo se recibió su saldo, y nunca lo que se le paga a los músicos.
    [Fact]
    public async Task Mias_ElClienteVeElSaldoRecibido_PeroNuncaElPagoNiLaFechaDePagoDeLosMusicos()
    {
        var received = Row();
        received.BalanceReceivedAt = new DateTime(2026, 12, 13, 15, 0, 0, DateTimeKind.Utc);
        _mediator.SendQueryAsync<GetMyEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetMyEventRequestsQuery>())
            .Returns([received, Row()]);

        var response = await _client.GetAsync("api/event-requests/mine");

        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);
        Assert.Equal("2026-12-13T15:00:00Z", json.RootElement[0].GetProperty("balanceReceivedAt").GetString());
        Assert.Equal(JsonValueKind.Null, json.RootElement[1].GetProperty("balanceReceivedAt").ValueKind);
        Assert.DoesNotContain("paidAt", body);
        Assert.DoesNotContain("myPay", body);
        Assert.DoesNotContain("setlist", body);
        Assert.DoesNotContain("attendees", body);
    }

    // T61 (S24): el cliente ve la fecha límite del anticipo y la del saldo en su lista y en su
    // detalle, como días del calendario ("YYYY-MM-DD"). Sin fecha cargada, el campo viaja nulo y el
    // texto del cliente queda como está.
    [Fact]
    public async Task Mias_ElClienteVeLaFechaLimiteDelAnticipoYDelSaldo()
    {
        var withDates = Row();
        withDates.Deposit = new GigDepositResponse { Amount = 4000m, DueDate = new DateOnly(2026, 11, 15) };
        withDates.BalanceDueDate = new DateOnly(2026, 12, 12);
        _mediator.SendQueryAsync<GetMyEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetMyEventRequestsQuery>())
            .Returns([withDates, Row()]);
        _mediator.SendQueryAsync<GetEventRequestByIdQuery, BookingResult<EventRequestResponse>>(Arg.Any<GetEventRequestByIdQuery>())
            .Returns(BookingResult<EventRequestResponse>.Success(withDates));

        var list = await _client.GetAsync("api/event-requests/mine");
        var detail = await _client.GetAsync("api/event-requests/7");

        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);

        using var listJson = JsonDocument.Parse(await list.Content.ReadAsStringAsync());
        Assert.Equal("2026-11-15", listJson.RootElement[0].GetProperty("deposit").GetProperty("dueDate").GetString());
        Assert.Equal("2026-12-12", listJson.RootElement[0].GetProperty("balanceDueDate").GetString());
        // Sin fecha cargada: nulo, nunca una fecha inventada.
        Assert.Equal(JsonValueKind.Null, listJson.RootElement[1].GetProperty("deposit").GetProperty("dueDate").ValueKind);
        Assert.Equal(JsonValueKind.Null, listJson.RootElement[1].GetProperty("balanceDueDate").ValueKind);

        using var detailJson = JsonDocument.Parse(await detail.Content.ReadAsStringAsync());
        Assert.Equal("2026-11-15", detailJson.RootElement.GetProperty("deposit").GetProperty("dueDate").GetString());
        Assert.Equal("2026-12-12", detailJson.RootElement.GetProperty("balanceDueDate").GetString());
    }

    // T59 (S22): el cliente nunca ve con quién toca el grupo ni el teléfono de su manager, ni en la
    // lista ni en el detalle: el contrato del cliente no cambia en absoluto.
    [Fact]
    public async Task Mias_ElClienteNoLlevaTelefonoDelManagerNiCompaneros_EnLaListaNiEnElDetalle()
    {
        _mediator.SendQueryAsync<GetMyEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetMyEventRequestsQuery>())
            .Returns([Row()]);
        _mediator.SendQueryAsync<GetEventRequestByIdQuery, BookingResult<EventRequestResponse>>(Arg.Any<GetEventRequestByIdQuery>())
            .Returns(BookingResult<EventRequestResponse>.Success(Row()));

        var list = await _client.GetAsync("api/event-requests/mine");
        var detail = await _client.GetAsync("api/event-requests/7");

        var listBody = await list.Content.ReadAsStringAsync();
        var detailBody = await detail.Content.ReadAsStringAsync();
        foreach (var body in new[] { listBody, detailBody })
        {
            Assert.DoesNotContain("managerPhone", body);
            Assert.DoesNotContain("teammates", body);
        }

        using var listJson = JsonDocument.Parse(listBody);
        Assert.Equal([.. LegacyKeys, "balanceReceivedAt", "balanceDueDate"], listJson.RootElement[0].EnumerateObject().Select(property => property.Name));
        using var detailJson = JsonDocument.Parse(detailBody);
        Assert.DoesNotContain("managerPhone", detailJson.RootElement.EnumerateObject().Select(property => property.Name));
        Assert.DoesNotContain("teammates", detailJson.RootElement.EnumerateObject().Select(property => property.Name));
    }

    [Fact]
    public async Task Mias_UsaElUsuarioDelToken()
    {
        _mediator.SendQueryAsync<GetMyEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetMyEventRequestsQuery>())
            .Returns([new EventRequestResponse { Id = 3 }]);

        var response = await _client.GetAsync("api/event-requests/mine");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetMyEventRequestsQuery, List<EventRequestResponse>>(
            Arg.Is<GetMyEventRequestsQuery>(q => q.ClientUserId == TestAuthHandler.UserId));
    }

    [Fact]
    public async Task BandejaDelGrupo_GrupoAjeno_Returns403()
    {
        var response = await _client.GetAsync($"api/groups/{ForeignGroupId}/event-requests");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendQueryAsync<GetGroupEventRequestsQuery, List<EventRequestResponse>>(
            Arg.Is<GetGroupEventRequestsQuery>(q => q.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task BandejaDelGrupo_Manager_PasaElFiltroDeEstado()
    {
        _mediator.SendQueryAsync<GetGroupEventRequestsQuery, List<EventRequestResponse>>(Arg.Any<GetGroupEventRequestsQuery>())
            .Returns([]);

        var response = await _client.GetAsync("api/groups/1/event-requests?status=Pending");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetGroupEventRequestsQuery, List<EventRequestResponse>>(
            Arg.Is<GetGroupEventRequestsQuery>(q => q.GroupId == 1 && q.Status == EventRequestStatus.Pending));
    }

    [Fact]
    public async Task Detalle_NoParticipante_Returns404()
    {
        _mediator.SendQueryAsync<GetEventRequestByIdQuery, BookingResult<EventRequestResponse>>(Arg.Is<GetEventRequestByIdQuery>(q => q.Id == 404))
            .Returns(BookingResult<EventRequestResponse>.NotFound());

        var response = await _client.GetAsync("api/event-requests/404");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await _mediator.Received().SendQueryAsync<GetEventRequestByIdQuery, BookingResult<EventRequestResponse>>(
            Arg.Is<GetEventRequestByIdQuery>(q => q.Id == 404 && q.UserId == TestAuthHandler.UserId && !q.IsAdmin));
    }

    [Theory]
    [InlineData("accept", EventRequestDecision.Accept)]
    [InlineData("decline", EventRequestDecision.Decline)]
    public async Task Responder_SinBody_UsaElUsuarioDelToken(string action, EventRequestDecision decision)
    {
        _mediator.SendCommandAsync<RespondToEventRequestCommand, BookingResult<EventRequestResponse>>(Arg.Any<RespondToEventRequestCommand>())
            .Returns(Ok(7));

        var response = await _client.PostAsync($"api/event-requests/7/{action}", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendCommandAsync<RespondToEventRequestCommand, BookingResult<EventRequestResponse>>(
            Arg.Is<RespondToEventRequestCommand>(c => c.Id == 7 && c.UserId == TestAuthHandler.UserId && c.Decision == decision && c.Message == null));
    }

    [Fact]
    public async Task Responder_TransicionInvalida_Returns409()
    {
        _mediator.SendCommandAsync<RespondToEventRequestCommand, BookingResult<EventRequestResponse>>(Arg.Is<RespondToEventRequestCommand>(c => c.Id == 8))
            .Returns(BookingResult<EventRequestResponse>.Failure(BookingErrorKind.Conflict, "Solo se puede aceptar una solicitud pendiente; esta está cancelada."));

        var response = await _client.PostAsJsonAsync("api/event-requests/8/accept", new { message = "Va" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("Solo se puede aceptar una solicitud pendiente", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Responder_MensajeDemasiadoLargo_Returns400()
    {
        var response = await _client.PostAsJsonAsync("api/event-requests/9/decline", new { message = new string('x', 2001) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Cancelar_UsaElUsuarioDelToken()
    {
        _mediator.SendCommandAsync<CancelEventRequestCommand, BookingResult<EventRequestResponse>>(Arg.Any<CancelEventRequestCommand>())
            .Returns(Ok(11));

        var response = await _client.PostAsync("api/event-requests/11/cancel", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received().SendCommandAsync<CancelEventRequestCommand, BookingResult<EventRequestResponse>>(
            Arg.Is<CancelEventRequestCommand>(c => c.Id == 11 && c.UserId == TestAuthHandler.UserId));
    }

    [Fact]
    public async Task Mensaje_ElRemitenteSaleDelToken()
    {
        _mediator.SendCommandAsync<PostEventRequestMessageCommand, BookingResult<EventRequestMessageResponse>>(Arg.Any<PostEventRequestMessageCommand>())
            .Returns(BookingResult<EventRequestMessageResponse>.Success(new EventRequestMessageResponse { Id = 1, Body = "Hola" }));

        var response = await _client.PostAsJsonAsync("api/event-requests/12/messages", new { body = "Hola", senderUserId = 77 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await _mediator.Received().SendCommandAsync<PostEventRequestMessageCommand, BookingResult<EventRequestMessageResponse>>(
            Arg.Is<PostEventRequestMessageCommand>(c => c.Id == 12 && c.UserId == TestAuthHandler.UserId && c.Body == "Hola"));
    }

    [Fact]
    public async Task Mensaje_Vacio_Returns400()
    {
        var response = await _client.PostAsJsonAsync("api/event-requests/12/messages", new { body = "   " });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
