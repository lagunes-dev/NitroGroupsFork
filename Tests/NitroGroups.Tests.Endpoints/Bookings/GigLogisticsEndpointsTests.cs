using Cortex.Mediator;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Details;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Pay;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace NitroGroups.Tests.Endpoints.Bookings;

/// <summary>
/// Logística del toque: <c>PUT api/groups/{groupId}/gigs/{id}/details</c> y <c>.../pay</c>.
/// Ambas exigen Owner/Manager del grupo de la ruta; el handler valida que el toque sea de ese grupo.
/// </summary>
public class GigLogisticsEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999;

    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public GigLogisticsEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
    }

    private static HttpRequestMessage Put(string url, string json)
        => new(HttpMethod.Put, url) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static GroupGigResponse Row() => new()
    {
        Id = 5, GroupId = 10, GroupName = "Los Vargas", GroupSlug = "los-vargas",
        EventDate = new DateOnly(2026, 12, 12), StartTime = new TimeOnly(20, 0), DurationHours = 5,
        EventType = "Boda", LocationText = "Salón Los Arcos, CDMX", Role = "Manager",
        Setlist = "Cielito lindo", CallTime = new TimeOnly(18, 30),
        Deposit = new GigDepositResponse { Amount = 5000m, ReceivedAt = new DateTime(2026, 11, 3, 18, 0, 0, DateTimeKind.Utc) },
        Attendees = [new GigAttendeeResponse { UserId = 400, FullName = "Mateo Ruiz", Status = "Confirmed", Pay = 1200m }]
    };

    private static readonly DateTime BalanceDate = new(2026, 12, 13, 15, 0, 0, DateTimeKind.Utc);

    public static TheoryData<string, string> Routes => new()
    {
        { "api/groups/10/gigs/5/details", "{\"setlist\":\"x\"}" },
        { "api/groups/10/gigs/5/pay", "{\"payments\":[]}" },
    };

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task SinToken_Returns401(string url, string json)
    {
        var response = await _anonymous.SendAsync(Put(url, json));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task UsuarioSinSincronizar_Returns401(string url, string json)
    {
        var response = await _unregistered.SendAsync(Put(url, json));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("details", "{\"setlist\":\"x\"}")]
    [InlineData("pay", "{\"payments\":[]}")]
    public async Task QuienNoAdministraElGrupo_Returns403_SinLlamarAlHandler(string action, string json)
    {
        var response = await _client.SendAsync(Put($"api/groups/{ForeignGroupId}/gigs/5/{action}", json));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Is<UpdateGigDetailsCommand>(c => c.GroupId == ForeignGroupId));
        await _mediator.DidNotReceive().SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Is<SetGigPayCommand>(c => c.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task Detalles_EnviaSoloLoQueVieneEnElBody_YDevuelveLaFilaDelManager()
    {
        UpdateGigDetailsCommand? sent = null;
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Do<UpdateGigDetailsCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details",
            "{\"callTime\":\"18:30:00\",\"depositReceived\":true,\"depositAmount\":null}"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(sent);
        Assert.Equal((10L, 5L, TestAuthHandler.UserId), (sent.GroupId, sent.GigId, sent.CallerUserId));
        Assert.False(sent.Body.HasSetlist);
        Assert.True(sent.Body.HasCallTime);
        Assert.Equal(new TimeOnly(18, 30), sent.Body.CallTime);
        Assert.True(sent.Body.HasDepositAmount);
        Assert.Null(sent.Body.DepositAmount);
        Assert.True(sent.Body.HasDepositReceived);
        Assert.True(sent.Body.DepositReceived);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var gig = json.RootElement;
        Assert.Equal("18:30:00", gig.GetProperty("callTime").GetString());
        Assert.Equal("Cielito lindo", gig.GetProperty("setlist").GetString());
        var deposit = gig.GetProperty("deposit");
        Assert.Equal(["amount", "receivedAt", "dueDate"], deposit.EnumerateObject().Select(p => p.Name));
        Assert.Equal(5000m, deposit.GetProperty("amount").GetDecimal());
        Assert.Equal("2026-11-03T18:00:00Z", deposit.GetProperty("receivedAt").GetString());
        Assert.Equal(1200m, gig.GetProperty("attendees")[0].GetProperty("pay").GetDecimal());
        Assert.False(gig.TryGetProperty("myPay", out _)); // el panel del manager no lleva myPay
    }

    [Fact]
    public async Task Detalles_ElBodyDeLaUi_SetlistVacioYCallTimeYAnticipoOmitidos()
    {
        UpdateGigDetailsCommand? sent = null;
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Do<UpdateGigDetailsCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details", "{\"setlist\":\"\",\"depositReceived\":false}"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(sent!.Body.HasSetlist);
        Assert.Equal("", sent.Body.Setlist);
        Assert.False(sent.Body.HasCallTime);
        Assert.False(sent.Body.HasDepositAmount);
        Assert.True(sent.Body.HasDepositReceived);
        Assert.False(sent.Body.DepositReceived);
    }

    [Fact]
    public async Task Detalles_ElBodyAcepta_HoraSinSegundos()
    {
        UpdateGigDetailsCommand? sent = null;
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Do<UpdateGigDetailsCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details", "{\"callTime\":\"18:30\"}"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new TimeOnly(18, 30), sent!.Body.CallTime);
    }

    [Fact]
    public async Task Fila_SinLogistica_DevuelveNulosYNuncaClavesFaltantes()
    {
        var bare = Row();
        bare.Setlist = null;
        bare.CallTime = null;
        bare.Deposit = new GigDepositResponse();
        bare.Attendees = [new GigAttendeeResponse { UserId = 400, FullName = "Mateo Ruiz", Status = "Confirmed" }];
        _mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Any<SetGigPayCommand>())
            .Returns(BookingResult<GroupGigResponse>.Success(bare));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/pay", "{\"payments\":[]}"));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var gig = json.RootElement;
        Assert.Equal(JsonValueKind.Null, gig.GetProperty("setlist").ValueKind);
        Assert.Equal(JsonValueKind.Null, gig.GetProperty("callTime").ValueKind);
        Assert.Equal(JsonValueKind.Null, gig.GetProperty("deposit").GetProperty("amount").ValueKind);
        Assert.Equal(JsonValueKind.Null, gig.GetProperty("deposit").GetProperty("receivedAt").ValueKind);
        Assert.Equal(JsonValueKind.Null, gig.GetProperty("attendees")[0].GetProperty("pay").ValueKind);
    }

    [Theory]
    [InlineData(BookingErrorKind.NotFound, HttpStatusCode.NotFound)]
    [InlineData(BookingErrorKind.Validation, HttpStatusCode.BadRequest)]
    public async Task Detalles_TraduceLosErroresDelHandler(BookingErrorKind kind, HttpStatusCode expected)
    {
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Any<UpdateGigDetailsCommand>())
            .Returns(BookingResult<GroupGigResponse>.Failure(kind, "mensaje del handler"));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details", "{\"setlist\":\"x\"}"));

        Assert.Equal(expected, response.StatusCode);
        Assert.Contains("mensaje del handler", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Pago_EnviaLaListaCompleta_YDevuelveLaFilaDelManager()
    {
        SetGigPayCommand? sent = null;
        _mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Do<SetGigPayCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/pay",
            "{\"payments\":[{\"userId\":400,\"amount\":1200.5},{\"userId\":500,\"amount\":0}]}"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(sent);
        Assert.Equal((10L, 5L, TestAuthHandler.UserId), (sent.GroupId, sent.GigId, sent.CallerUserId));
        Assert.Equal([(400L, 1200.5m), (500L, 0m)], sent.Body.Payments!.Select(p => (p.UserId, p.Amount)));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(1200m, json.RootElement.GetProperty("attendees")[0].GetProperty("pay").GetDecimal());
    }

    [Fact]
    public async Task Pago_SinBody_LlegaAlHandlerSinLista()
    {
        SetGigPayCommand? sent = null;
        _mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Do<SetGigPayCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Failure(BookingErrorKind.Validation, "Envía la lista de pagos."));

        var response = await _client.PutAsync("api/groups/10/gigs/5/pay", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(sent!.Body.Payments);
    }

    [Fact]
    public async Task Pago_ToqueAjeno_Returns404()
    {
        _mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Any<SetGigPayCommand>())
            .Returns(BookingResult<GroupGigResponse>.Failure(BookingErrorKind.NotFound, "Toque no encontrado."));

        var response = await _client.PutAsJsonAsync("api/groups/10/gigs/404/pay", new { payments = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // T48 (S18): saldo recibido y pagado como dato, igual que el anticipo.
    [Theory]
    [InlineData("{\"balanceReceived\":true}", true, true)]
    [InlineData("{\"balanceReceived\":false}", true, false)]
    [InlineData("{\"setlist\":\"x\"}", false, null)]
    public async Task Detalles_SaldoRecibido_TrueFalseUOmitido(string json, bool expectedHas, bool? expectedValue)
    {
        UpdateGigDetailsCommand? sent = null;
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Do<UpdateGigDetailsCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details", json));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expectedHas, sent!.Body.HasBalanceReceived);
        Assert.Equal(expectedValue, sent.Body.BalanceReceived);
        Assert.False(sent.Body.HasDepositReceived); // el saldo no toca el anticipo
    }

    [Fact]
    public async Task Detalles_SaldoRecibido_QuienNoAdministraElGrupo_Returns403_SinLlamarAlHandler()
    {
        var response = await _client.SendAsync(Put($"api/groups/{ForeignGroupId}/gigs/5/details", "{\"balanceReceived\":true}"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Is<UpdateGigDetailsCommand>(c => c.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task Pago_CadaPagoPuedeLlevarPaid_YOmitidoLlegaComoNulo()
    {
        SetGigPayCommand? sent = null;
        _mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Do<SetGigPayCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/pay",
            "{\"payments\":[{\"userId\":400,\"amount\":1200,\"paid\":true},{\"userId\":500,\"amount\":900,\"paid\":false},{\"userId\":600,\"amount\":800}]}"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal([(400L, (bool?)true), (500L, false), (600L, null)], sent!.Body.Payments!.Select(p => (p.UserId, p.Paid)));
    }

    [Fact]
    public async Task Pago_QuienNoAdministraElGrupo_ConPaid_Returns403_SinLlamarAlHandler()
    {
        var response = await _client.SendAsync(Put($"api/groups/{ForeignGroupId}/gigs/5/pay",
            "{\"payments\":[{\"userId\":400,\"amount\":1200,\"paid\":true}]}"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await _mediator.DidNotReceive().SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Is<SetGigPayCommand>(c => c.GroupId == ForeignGroupId));
    }

    [Fact]
    public async Task Fila_DelManager_LlevaElSaldoRecibidoYLaFechaDePagoDeCadaMusico_ConNulosSiNoHay()
    {
        var row = Row();
        row.BalanceReceivedAt = BalanceDate;
        row.Attendees =
        [
            new GigAttendeeResponse { UserId = 400, FullName = "Mateo Ruiz", Status = "Confirmed", Pay = 1200m, PaidAt = BalanceDate },
            new GigAttendeeResponse { UserId = 500, FullName = "Luis Peña", Status = "Confirmed", Pay = 900m }
        ];
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Any<UpdateGigDetailsCommand>())
            .Returns(BookingResult<GroupGigResponse>.Success(row));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details", "{\"balanceReceived\":true}"));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var gig = json.RootElement;
        Assert.Equal("2026-12-13T15:00:00Z", gig.GetProperty("balanceReceivedAt").GetString());
        Assert.Equal("2026-12-13T15:00:00Z", gig.GetProperty("attendees")[0].GetProperty("paidAt").GetString());
        Assert.Equal(JsonValueKind.Null, gig.GetProperty("attendees")[1].GetProperty("paidAt").ValueKind);
        // Los campos de siempre siguen en su orden y lo nuevo entra al final de su objeto.
        Assert.Equal(["amount", "receivedAt", "dueDate"], gig.GetProperty("deposit").EnumerateObject().Select(p => p.Name));
        Assert.Equal(["userId", "fullName", "status", "pay", "paidAt"], gig.GetProperty("attendees")[0].EnumerateObject().Select(p => p.Name));
    }

    [Fact]
    public async Task Fila_SinSaldoNiPagos_DevuelveNulosYNuncaClavesFaltantes()
    {
        var bare = Row();
        bare.Attendees = [new GigAttendeeResponse { UserId = 400, FullName = "Mateo Ruiz", Status = "Confirmed" }];
        _mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Any<SetGigPayCommand>())
            .Returns(BookingResult<GroupGigResponse>.Success(bare));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/pay", "{\"payments\":[]}"));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("balanceReceivedAt").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("attendees")[0].GetProperty("paidAt").ValueKind);
    }

    // T61 (S24): el anticipo y el saldo llevan fecha límite. Son días del calendario, como la fecha
    // del evento: viajan como "YYYY-MM-DD", y null limpia la fecha.
    [Theory]
    [InlineData("{\"depositDueDate\":\"2026-11-15\"}", true, true, "2026-11-15")]
    [InlineData("{\"depositDueDate\":null}", true, false, null)]
    [InlineData("{\"setlist\":\"x\"}", false, false, null)]
    public async Task Detalles_FechaLimiteDelAnticipo_ViajaComoDiaDelCalendario_YNullLaLimpia(
        string json, bool expectedHas, bool expectedPresent, string? expectedDate)
    {
        UpdateGigDetailsCommand? sent = null;
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Do<UpdateGigDetailsCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details", json));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expectedHas, sent!.Body.HasDepositDueDate);
        Assert.Equal(expectedPresent ? new DateOnly(2026, 11, 15) : null, sent.Body.DepositDueDate);
        if (expectedDate is not null)
            Assert.Equal(expectedDate, sent.Body.DepositDueDate?.ToString("yyyy-MM-dd"));
        Assert.False(sent.Body.HasBalanceDueDate); // el anticipo no toca la fecha del saldo
    }

    [Fact]
    public async Task Detalles_FechaLimiteDelSaldo_ViajaComoDiaDelCalendario_YNullLaLimpia()
    {
        UpdateGigDetailsCommand? sent = null;
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Do<UpdateGigDetailsCommand>(c => sent = c))
            .Returns(BookingResult<GroupGigResponse>.Success(Row()));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details",
            "{\"depositDueDate\":\"2026-11-15\",\"balanceDueDate\":\"2026-12-12\"}"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new DateOnly(2026, 11, 15), sent!.Body.DepositDueDate);
        Assert.Equal(new DateOnly(2026, 12, 12), sent.Body.BalanceDueDate);

        await _client.SendAsync(Put("api/groups/10/gigs/5/details", "{\"balanceDueDate\":null}"));

        Assert.True(sent.Body.HasBalanceDueDate);
        Assert.Null(sent.Body.BalanceDueDate);
    }

    [Fact]
    public async Task Fila_DelManager_LlevaLaFechaLimiteDelAnticipoYDelSaldo_ConNulosSiNoHay()
    {
        var row = Row();
        row.Deposit.DueDate = new DateOnly(2026, 11, 15);
        row.BalanceDueDate = new DateOnly(2026, 12, 12);
        _mediator.SendCommandAsync<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>(Arg.Any<UpdateGigDetailsCommand>())
            .Returns(BookingResult<GroupGigResponse>.Success(row));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/details", "{\"depositDueDate\":\"2026-11-15\"}"));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var gig = json.RootElement;
        Assert.Equal("2026-11-15", gig.GetProperty("deposit").GetProperty("dueDate").GetString());
        Assert.Equal("2026-12-12", gig.GetProperty("balanceDueDate").GetString());
    }

    [Fact]
    public async Task Fila_SinFechasLimite_LasDevuelveNulasYNuncaClavesFaltantes()
    {
        var bare = Row();
        bare.Deposit = new GigDepositResponse { Amount = 5000m };
        _mediator.SendCommandAsync<SetGigPayCommand, BookingResult<GroupGigResponse>>(Arg.Any<SetGigPayCommand>())
            .Returns(BookingResult<GroupGigResponse>.Success(bare));

        var response = await _client.SendAsync(Put("api/groups/10/gigs/5/pay", "{\"payments\":[]}"));

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("deposit").GetProperty("dueDate").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("balanceDueDate").ValueKind);
    }
}
