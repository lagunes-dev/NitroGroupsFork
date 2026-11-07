using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Notices;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// S12: el aviso preestablecido del músico al manager (llegada, pago o setlist), y las dos lecturas
/// que lo hacen visible. El aviso lo manda un miembro activo del grupo; la lectura del grupo es
/// solo del Owner/Manager. El cuerpo lleva el tipo y nada más: no hay texto libre.
/// </summary>
public class GigNoticesEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999;
    private const string PostUrl = "api/groups/10/gigs/5/notices";
    private const string GroupListUrl = "api/groups/10/gig-notices";
    private const string MyListUrl = "api/me/gig-notices/today";

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public GigNoticesEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
    }

    private static HttpRequestMessage Post(string url, string json)
        => new(HttpMethod.Post, url) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static GigNoticeResponse Row(string kind = "Pay", string fullName = "Mateo Ruiz", DateOnly? sentOn = null) => new()
    {
        GigId = 5,
        UserId = 400,
        FullName = fullName,
        Kind = kind,
        SentOn = sentOn ?? new DateOnly(2026, 11, 3)
    };

    [Fact]
    public async Task AvisoSinToken_Returns401()
    {
        // Un toque propio de este test: el mediador es compartido y las llamadas se acumulan entre casos.
        var response = await _anonymous.SendAsync(Post("api/groups/10/gigs/9001/notices", "{\"kind\":\"Pay\"}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await _mediator.DidNotReceive().SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(
            Arg.Is<PostGigNoticeCommand>(command => command.GigId == 9001));
    }

    [Fact]
    public async Task AvisoDeUsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.SendAsync(Post(PostUrl, "{\"kind\":\"Pay\"}"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Aviso_EnviaElGrupoElToqueYElTipo_YDevuelveElAvisoGuardado()
    {
        PostGigNoticeCommand? sent = null;
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Do<PostGigNoticeCommand>(c => sent = c))
            .Returns(BookingResult<GigNoticeResponse>.Success(Row()));

        var response = await _client.SendAsync(Post(PostUrl, "{\"kind\":\"Pay\"}"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(sent);
        Assert.Equal((10L, 5L, TestAuthHandler.UserId), (sent.GroupId, sent.GigId, sent.CallerUserId));
        Assert.Equal("Pay", sent.Body.Kind);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var notice = json.RootElement;
        Assert.Equal(5, notice.GetProperty("gigId").GetInt64());
        Assert.Equal(400, notice.GetProperty("userId").GetInt64());
        Assert.Equal("Mateo Ruiz", notice.GetProperty("fullName").GetString());
        Assert.Equal("Pay", notice.GetProperty("kind").GetString());
        Assert.Equal("2026-11-03", notice.GetProperty("sentOn").GetString());
        Assert.DoesNotContain(notice.EnumerateObject(), property => property.Name is "message" or "text" or "body");
    }

    [Fact]
    public void ElCuerpoDelAvisoSoloLlevaElTipo()
    {
        // La regla del usuario: el aviso es preestablecido, sin chat libre. Si alguien agrega un
        // campo de texto, este test lo frena antes de que llegue a la API.
        var properties = typeof(PostGigNoticeBody).GetProperties().Select(property => property.Name);

        Assert.Equal(["Kind"], properties);
    }

    [Fact]
    public async Task Aviso_SinBody_LlegaAlHandlerSinTipo()
    {
        PostGigNoticeCommand? sent = null;
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Do<PostGigNoticeCommand>(c => sent = c))
            .Returns(BookingResult<GigNoticeResponse>.Failure(BookingErrorKind.Validation, "El aviso tiene que ser de llegada, pago, setlist, llegada tarde o lugar."));

        var response = await _client.PostAsync(PostUrl, null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(sent!.Body.Kind);
    }

    [Theory]
    [InlineData(BookingErrorKind.Validation, HttpStatusCode.BadRequest)]
    [InlineData(BookingErrorKind.NotFound, HttpStatusCode.NotFound)]
    [InlineData(BookingErrorKind.Forbidden, HttpStatusCode.Forbidden)]
    [InlineData(BookingErrorKind.Conflict, HttpStatusCode.Conflict)]
    public async Task Aviso_TraduceLosErroresDelHandler(BookingErrorKind kind, HttpStatusCode expected)
    {
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Any<PostGigNoticeCommand>())
            .Returns(BookingResult<GigNoticeResponse>.Failure(kind, "mensaje del handler"));

        var response = await _client.SendAsync(Post(PostUrl, "{\"kind\":\"Pay\"}"));

        Assert.Equal(expected, response.StatusCode);
        Assert.Contains("mensaje del handler", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AvisoRepetido_RespondeIgualQueElPrimero()
    {
        // El handler devuelve la fila del día cuando ya existe: el endpoint responde lo mismo.
        const string url = "api/groups/10/gigs/9002/notices";
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Is<PostGigNoticeCommand>(command => command.GigId == 9002))
            .Returns(BookingResult<GigNoticeResponse>.Success(Row()));

        var first = await _client.SendAsync(Post(url, "{\"kind\":\"Pay\"}"));
        var second = await _client.SendAsync(Post(url, "{\"kind\":\"Pay\"}"));

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(first.StatusCode, second.StatusCode);
        Assert.Equal(await first.Content.ReadAsStringAsync(), await second.Content.ReadAsStringAsync());
        await _mediator.Received(2).SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(
            Arg.Is<PostGigNoticeCommand>(command => command.GigId == 9002));
    }

    [Fact]
    public async Task ListadoDelGrupo_QuienNoLoAdministra_Returns403_SinLlamarAlHandler()
    {
        var response = await _client.GetAsync($"api/groups/{ForeignGroupId}/gig-notices");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendQueryAsync<GetGroupGigNoticesQuery, List<GigNoticeResponse>>(Arg.Is<GetGroupGigNoticesQuery>(query => query.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task ListadoDelGrupo_DevuelveNombreTipoYFecha_EnElOrdenQueMandaElHandler()
    {
        _mediator.SendQueryAsync<GetGroupGigNoticesQuery, List<GigNoticeResponse>>(Arg.Any<GetGroupGigNoticesQuery>())
            .Returns(new List<GigNoticeResponse>
            {
                Row("Pay", "Mateo Ruiz"),
                Row("Setlist", "Sofía Nava", new DateOnly(2026, 11, 2))
            });

        var response = await _client.GetAsync(GroupListUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var rows = json.RootElement.EnumerateArray().ToList();
        Assert.Equal(2, rows.Count);
        Assert.Equal(("Mateo Ruiz", "Pay", "2026-11-03"), (
            rows[0].GetProperty("fullName").GetString(),
            rows[0].GetProperty("kind").GetString(),
            rows[0].GetProperty("sentOn").GetString()));
        Assert.Equal("Sofía Nava", rows[1].GetProperty("fullName").GetString());
    }

    [Fact]
    public async Task ListadoDelGrupo_SinAvisos_DevuelveUnaListaVacia()
    {
        _mediator.SendQueryAsync<GetGroupGigNoticesQuery, List<GigNoticeResponse>>(Arg.Any<GetGroupGigNoticesQuery>())
            .Returns(new List<GigNoticeResponse>());

        var response = await _client.GetAsync(GroupListUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task MisAvisosDeHoy_SinToken_Returns401()
    {
        var response = await _anonymous.GetAsync(MyListUrl);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MisAvisosDeHoy_PideLosDelLlamante_YNuncaLosDeOtro()
    {
        GetMyGigNoticesTodayQuery? sent = null;
        _mediator.SendQueryAsync<GetMyGigNoticesTodayQuery, List<GigNoticeResponse>>(Arg.Do<GetMyGigNoticesTodayQuery>(q => sent = q))
            .Returns([Row()]);

        var response = await _client.GetAsync(MyListUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(TestAuthHandler.UserId, sent!.UserId);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("Pay", json.RootElement[0].GetProperty("kind").GetString());
        Assert.Equal("2026-11-03", json.RootElement[0].GetProperty("sentOn").GetString());
    }

    [Fact]
    public async Task MisAvisosDeHoy_SinAvisos_DevuelveUnaListaVacia()
    {
        _mediator.SendQueryAsync<GetMyGigNoticesTodayQuery, List<GigNoticeResponse>>(Arg.Any<GetMyGigNoticesTodayQuery>())
            .Returns(new List<GigNoticeResponse>());

        var response = await _client.GetAsync(MyListUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }

    // T47 / S17: los dos tipos nuevos viajan con su literal estable y los mismos códigos de error.

    [Theory]
    [InlineData("Late")]
    [InlineData("CannotFindVenue")]
    public async Task AvisoNuevo_Aceptado_Returns201ConElTipo(string kind)
    {
        PostGigNoticeCommand? sent = null;
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Do<PostGigNoticeCommand>(c => sent = c))
            .Returns(BookingResult<GigNoticeResponse>.Success(Row(kind)));

        var response = await _client.SendAsync(Post(PostUrl, $"{{\"kind\":\"{kind}\"}}"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(kind, sent!.Body.Kind);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(kind, json.RootElement.GetProperty("kind").GetString());
    }

    [Fact]
    public async Task AvisoNuevoRepetido_MismoDia_RespondeIgualQueElPrimero()
    {
        const string url = "api/groups/10/gigs/9003/notices";
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Is<PostGigNoticeCommand>(command => command.GigId == 9003))
            .Returns(BookingResult<GigNoticeResponse>.Success(Row("Late")));

        var first = await _client.SendAsync(Post(url, "{\"kind\":\"Late\"}"));
        var second = await _client.SendAsync(Post(url, "{\"kind\":\"Late\"}"));

        Assert.Equal(first.StatusCode, second.StatusCode);
        Assert.Equal(await first.Content.ReadAsStringAsync(), await second.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AvisoNuevo_ToquePasado_Returns409ConElMensajeEnEspanol()
    {
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Any<PostGigNoticeCommand>())
            .Returns(BookingResult<GigNoticeResponse>.Failure(BookingErrorKind.Conflict, "Ese toque ya pasó: ya no se puede avisar que llegas tarde o que no encuentras el lugar."));

        var response = await _client.SendAsync(Post(PostUrl, "{\"kind\":\"CannotFindVenue\"}"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("ya pasó", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AvisoNuevo_NoMiembro_Returns403()
    {
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Any<PostGigNoticeCommand>())
            .Returns(BookingResult<GigNoticeResponse>.Failure(BookingErrorKind.Forbidden, "Solo un miembro activo del grupo puede avisar del toque."));

        var response = await _client.SendAsync(Post(PostUrl, "{\"kind\":\"Late\"}"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AvisoDeTipoDesconocido_SigueSiendo400()
    {
        _mediator.SendCommandAsync<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>(Arg.Any<PostGigNoticeCommand>())
            .Returns(BookingResult<GigNoticeResponse>.Failure(BookingErrorKind.Validation, "El aviso tiene que ser de llegada, pago, setlist, llegada tarde o lugar."));

        var response = await _client.SendAsync(Post(PostUrl, "{\"kind\":\"late\"}"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
