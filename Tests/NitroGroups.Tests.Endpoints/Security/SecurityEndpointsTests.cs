using Cortex.Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Create;
using NitroGroups.Core.Users.Application.UseCases.Musicians.Create;
using NitroGroups.Core.Users.Application.UseCases.Users.Sync;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Requests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Users.Requests;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;
using System.Net;
using System.Net.Http.Json;

namespace NitroGroups.Tests.Endpoints.Security;

/// <summary>
/// Reglas de seguridad de la API: deny-by-default, identidad desde el token y
/// permisos por grupo (Owner/Manager).
/// </summary>
public class SecurityEndpointsTests : IClassFixture<NitroGroupsWebAppFactory>
{
    private const long ForeignGroupId = 999;   // grupo que el usuario de test NO administra
    private const long MissingGroupId = 998;   // grupo que no existe

    private readonly NitroGroupsWebAppFactory _factory;
    private readonly HttpClient _client;
    private readonly HttpClient _anonymous;
    private readonly HttpClient _unregistered;
    private readonly IMediator _mediator;

    public SecurityEndpointsTests(NitroGroupsWebAppFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _anonymous = factory.CreateClient();
        _anonymous.DefaultRequestHeaders.Add(TestAuthHandler.AnonymousHeader, "1");
        _unregistered = factory.CreateClient();
        _unregistered.DefaultRequestHeaders.Add(TestAuthHandler.UnregisteredHeader, "1");
        _mediator = factory.Mediator;

        factory.GroupsModule.CanManageGroupAsync(ForeignGroupId, Arg.Any<long>(), Arg.Any<CancellationToken>()).Returns(false);
        factory.GroupsModule.GroupExistsAsync(MissingGroupId, Arg.Any<CancellationToken>()).Returns(false);
    }

    /// <summary>
    /// Únicos endpoints públicos permitidos. Agregar uno nuevo acá es una decisión explícita.
    /// </summary>
    private static readonly HashSet<string> PublicEndpoints =
    [
        "GET api/genres",
        "GET api/groups/slug/{slug}",
        "GET api/groups/search",
        "GET api/groups/{groupId:long}/members",
        "GET api/groups/{groupId:long}/media",
        "GET api/groups/{groupId:long}/schedule",
        "GET api/groups/{id}/schedules",
        "GET /openapi/{documentName}.json",
    ];

    [Fact]
    public void SoloLosEndpointsDeLaAllowlistSonPublicos()
    {
        var anonymous = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(e => $"{e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.FirstOrDefault() ?? "ANY"} {e.RoutePattern.RawText}")
            .Where(e => !e.Contains("/health") && !e.Contains("/alive"))
            .ToHashSet();

        var unexpected = anonymous.Except(PublicEndpoints).ToList();
        Assert.True(unexpected.Count == 0, "Endpoints públicos no declarados: " + string.Join(", ", unexpected));
    }

    [Theory]
    [InlineData("PUT", "api/groups/1")]
    [InlineData("POST", "api/groups/1/genres")]
    [InlineData("DELETE", "api/groups/1/media/5")]
    [InlineData("POST", "api/groups/1/schedule")]
    [InlineData("POST", "api/groups/1/busy-schedules")]
    [InlineData("POST", "api/groups")]
    [InlineData("POST", "api/auth/sync")]
    [InlineData("GET", "api/users/1/groups")]
    [InlineData("GET", "api/musicians/open-to-join")]
    public async Task EndpointsPrivados_SinToken_Returns401(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("PUT", "api/groups/999")]
    [InlineData("POST", "api/groups/999/genres")]
    [InlineData("DELETE", "api/groups/999/genres/2")]
    [InlineData("POST", "api/groups/999/media")]
    [InlineData("DELETE", "api/groups/999/media/5")]
    [InlineData("POST", "api/groups/999/media/upload")]
    [InlineData("POST", "api/groups/999/schedule")]
    [InlineData("PATCH", "api/groups/999/schedule/3")]
    [InlineData("DELETE", "api/groups/999/schedule/3")]
    [InlineData("POST", "api/groups/999/busy-schedules")]
    [InlineData("PUT", "api/groups/999/busy-schedules/3")]
    [InlineData("DELETE", "api/groups/999/busy-schedules/3")]
    public async Task EscriturasDeGrupo_SinSerOwnerNiManager_Returns403(string method, string url)
    {
        using var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = JsonContent.Create(new { }) };

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task EscrituraDeGrupo_GrupoInexistente_Returns404()
    {
        var response = await _client.PostAsJsonAsync($"api/groups/{MissingGroupId}/genres", new AssignGenresRequest());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task EscrituraDeGrupo_UsuarioSinSincronizar_Returns401()
    {
        var response = await _unregistered.PostAsJsonAsync("api/groups/1/genres", new AssignGenresRequest());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Admin_PuedeAdministrarUnGrupoAjeno_AunSinSincronizar(bool unregistered)
    {
        _mediator
            .SendCommandAsync<NitroGroups.Core.Groups.Application.UseCases.Groups.Update.UpdateGroupCommand, Result<GroupResponse>>(
                Arg.Is<NitroGroups.Core.Groups.Application.UseCases.Groups.Update.UpdateGroupCommand>(c => c.Id == ForeignGroupId))
            .Returns(Result<GroupResponse>.Success(new GroupResponse { Id = ForeignGroupId, Slug = "ajeno" }));

        using var request = new HttpRequestMessage(HttpMethod.Put, $"api/groups/{ForeignGroupId}")
        {
            Content = JsonContent.Create(new UpdateGroupRequest { Slug = "ajeno", GroupName = "Ajeno", Email = "a@b.com", Currency = "MXN" })
        };
        request.Headers.Add(TestAuthHandler.AdminHeader, "1");
        if (unregistered) request.Headers.Add(TestAuthHandler.UnregisteredHeader, "1");

        var response = await _client.SendAsync(request);

        // 200 prueba que el filtro dejó pasar y que el handler se ejecutó.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("ajeno", (await response.Content.ReadFromJsonAsync<GroupResponse>(ApiJsonOptions.Default))!.Slug);
    }

    [Fact]
    public async Task Admin_PuedeLeerOtroUsuarioPorAuth0Id()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/users/auth0/{Uri.EscapeDataString("auth0|otro")}");
        request.Headers.Add(TestAuthHandler.AdminHeader, "1");

        _mediator
            .SendQueryAsync<NitroGroups.Core.Users.Application.UseCases.Users.GetByAuth0Id.GetByAuth0IdQuery, UserDto?>(
                Arg.Is<NitroGroups.Core.Users.Application.UseCases.Users.GetByAuth0Id.GetByAuth0IdQuery>(q => q.Auth0Id == "auth0|otro"))
            .Returns(new UserDto { Id = 50, Auth0Id = "auth0|otro" });

        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CrearMusico_SinUserInfo_Returns400()
    {
        var response = await _client.PostAsync("api/musicians", JsonContent.Create(new { userInfo = (object?)null, musicianProfile = new { } }));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CrearGrupo_IgnoraOwnerUserIdDelBody_YUsaElDelToken()
    {
        _mediator
            .SendCommandAsync<CreateGroupCommand, Result<GroupResponse>>(Arg.Any<CreateGroupCommand>())
            .Returns(new GroupResponse { Id = 1 });

        var request = new CreateGroupRequest { OwnerUserId = 12345, Slug = "los-del-token", GroupName = "Los del Token", Email = "a@b.com" };
        await _client.PostAsJsonAsync("api/groups", request, ApiJsonOptions.Default);

        await _mediator.Received().SendCommandAsync<CreateGroupCommand, Result<GroupResponse>>(
            Arg.Is<CreateGroupCommand>(c => c.OwnerUserId == TestAuthHandler.UserId && c.Slug == "los-del-token"));
    }

    [Fact]
    public async Task Sync_IgnoraAuth0IdDelBody_YUsaElDelToken()
    {
        _mediator
            .SendCommandAsync<SyncUserCommand, UserDto>(Arg.Any<SyncUserCommand>())
            .Returns(new UserDto { Id = 1 });

        var request = new SyncUserRequest { Auth0Id = "auth0|suplantado", Email = "otro@example.com", FirstName = "A", LastName = "B" };
        await _client.PostAsJsonAsync("api/auth/sync", request, ApiJsonOptions.Default);

        await _mediator.Received().SendCommandAsync<SyncUserCommand, UserDto>(
            Arg.Is<SyncUserCommand>(c => c.Auth0Id == "auth0|test-user-id" && c.Email == "test@example.com"));
    }

    [Fact]
    public async Task CrearMusico_IgnoraAuth0IdDelBody_YUsaElDelToken()
    {
        _mediator
            .SendCommandAsync<CreateMusicianCommand, Result<MusicianDto>>(Arg.Any<CreateMusicianCommand>())
            .Returns(new MusicianDto { Id = 1 });

        var request = new CreateMusicianRequest
        {
            UserInfo = new UserInfoData { Auth0Id = "auth0|suplantado", Email = "otro@example.com", FirstName = "A", LastName = "B" },
            MusicianProfile = new MusicianProfileData { ShortBio = "Bajista", YearsExperience = 2 }
        };
        await _client.PostAsJsonAsync("api/musicians", request, ApiJsonOptions.Default);

        await _mediator.Received().SendCommandAsync<CreateMusicianCommand, Result<MusicianDto>>(
            Arg.Is<CreateMusicianCommand>(c => c.UserInfo.Auth0Id == "auth0|test-user-id"));
    }
}
