using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cortex.Mediator;
using NitroGroups.Core.Groups.Application.UseCases.Groups.CheckSlugAvailability;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Create;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetBySlug;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetByUserId;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetMembersRoleByIdGroup;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Update;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Requests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NSubstitute;
using NitroGroups.Tests.Endpoints.Infrastructure;

namespace NitroGroups.Tests.Endpoints.Groups;

public class GroupsEndpointsTests(NitroGroupsWebAppFactory factory) : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly IMediator _mediator = factory.Mediator;

    private static GroupResponse BuildGroupResponse(long id = 1, string slug = "los-rockers") => new()
    {
        Id = id,
        Slug = slug,
        GroupName = "Los Rockers",
        OwnerUserId = 10,
        Active = true
    };

    // ---------------------------------------------------------------
    // POST api/groups
    // ---------------------------------------------------------------

    [Fact]
    public async Task CreateGroup_ValidRequest_Returns201()
    {
        var request = new CreateGroupRequest
        {
            OwnerUserId = 10,
            Slug = "los-rockers",
            GroupName = "Los Rockers",
            Email = "band@example.com",
            Phone = "5551234567"
        };

        _mediator
            .SendCommandAsync<CreateGroupCommand, Result<GroupResponse>>(Arg.Any<CreateGroupCommand>())
            .Returns(Result<GroupResponse>.Success(BuildGroupResponse()));

        var response = await _client.PostAsJsonAsync("api/groups", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<GroupResponse>();
        Assert.Equal("los-rockers", result!.Slug);
    }

    [Fact]
    public async Task CreateGroup_ComandoFalla_Returns400()
    {
        var request = new CreateGroupRequest { OwnerUserId = 0, Slug = "dup", GroupName = "Dup" };

        _mediator
            .SendCommandAsync<CreateGroupCommand, Result<GroupResponse>>(Arg.Any<CreateGroupCommand>())
            .Returns(Result<GroupResponse>.Failure("El slug ya está en uso."));

        var response = await _client.PostAsJsonAsync("api/groups", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------
    // GET api/groups/slug/{slug}
    // ---------------------------------------------------------------

    [Fact]
    public async Task GetBySlug_Existente_Returns200()
    {
        _mediator
            .SendQueryAsync<GetGroupBySlugQuery, Result<GroupResponse>>(Arg.Any<GetGroupBySlugQuery>())
            .Returns(Result<GroupResponse>.Success(BuildGroupResponse()));

        var response = await _client.GetAsync("api/groups/slug/los-rockers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<GroupResponse>();
        Assert.Equal("los-rockers", result!.Slug);
    }

    [Fact]
    public async Task GetBySlug_NoExiste_Returns404()
    {
        _mediator
            .SendQueryAsync<GetGroupBySlugQuery, Result<GroupResponse>>(Arg.Any<GetGroupBySlugQuery>())
            .Returns(Result<GroupResponse>.Failure("No encontrado."));

        var response = await _client.GetAsync("api/groups/slug/no-existe");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---------------------------------------------------------------
    // GET api/groups/check-slug/{slug}
    // ---------------------------------------------------------------

    [Fact]
    public async Task CheckSlug_Disponible_Returns200ConAvailableTrue()
    {
        _mediator
            .SendQueryAsync<CheckSlugAvailabilityQuery, Result<bool>>(Arg.Any<CheckSlugAvailabilityQuery>())
            .Returns(Result<bool>.Success(true));

        var response = await _client.GetAsync("api/groups/check-slug/nuevo-slug");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.True(json.GetProperty("available").GetBoolean());
    }

    [Fact]
    public async Task CheckSlug_Ocupado_Returns200ConAvailableFalse()
    {
        _mediator
            .SendQueryAsync<CheckSlugAvailabilityQuery, Result<bool>>(Arg.Any<CheckSlugAvailabilityQuery>())
            .Returns(Result<bool>.Success(false));

        var response = await _client.GetAsync("api/groups/check-slug/slug-ocupado");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        Assert.False(json.GetProperty("available").GetBoolean());
    }

    // ---------------------------------------------------------------
    // GET api/users/{userId}/groups
    // ---------------------------------------------------------------

    [Fact]
    public async Task GetGroupByUserId_Existente_Returns200()
    {
        _mediator
            .SendQueryAsync<GetGroupByUserIdQuery, Result<GroupResponse?>>(Arg.Any<GetGroupByUserIdQuery>())
            .Returns(Result<GroupResponse?>.Success(BuildGroupResponse()));

        var response = await _client.GetAsync("api/users/10/groups");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetGroupByUserId_SinGrupoPropio_Returns200ConBodyNulo()
    {
        // Un usuario que existe y todavía no tiene grupo es una respuesta, no un error: el front lo
        // lee como "sin grupo" y así la consola deja de llenarse de 404 en cada carga (T22).
        _mediator
            .SendQueryAsync<GetGroupByUserIdQuery, Result<GroupResponse?>>(Arg.Any<GetGroupByUserIdQuery>())
            .Returns(Result<GroupResponse?>.Success(null));

        var response = await _client.GetAsync("api/users/99/groups");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Null, json.RootElement.ValueKind);
    }

    [Fact]
    public async Task GetGroupByUserId_UsuarioInexistente_Returns404()
    {
        // El 404 sigue existiendo para lo que de verdad no existe: un usuario sin fila.
        _mediator
            .SendQueryAsync<GetGroupByUserIdQuery, Result<GroupResponse?>>(Arg.Any<GetGroupByUserIdQuery>())
            .Returns(Result<GroupResponse?>.Failure("No se encontro ningun usuario con ese id"));

        var response = await _client.GetAsync("api/users/99/groups");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---------------------------------------------------------------
    // PUT api/groups/{id}
    // ---------------------------------------------------------------

    [Fact]
    public async Task UpdateGroup_ValidRequest_Returns200()
    {
        var request = new UpdateGroupRequest
        {
            Slug = "los-rockers-v2",
            GroupName = "Los Rockers v2",
            Email = "v2@example.com",
            Phone = "5550000000",
            Currency = "MXN"
        };

        _mediator
            .SendCommandAsync<UpdateGroupCommand, Result<GroupResponse>>(Arg.Any<UpdateGroupCommand>())
            .Returns(Result<GroupResponse>.Success(BuildGroupResponse(1, "los-rockers-v2")));

        var response = await _client.PutAsJsonAsync("api/groups/1", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<GroupResponse>();
        Assert.Equal("los-rockers-v2", result!.Slug);
    }

    [Fact]
    public async Task UpdateGroup_ComandoFalla_Returns400()
    {
        var request = new UpdateGroupRequest { Slug = "conflicto", GroupName = "Conflicto", Currency = "MXN" };

        _mediator
            .SendCommandAsync<UpdateGroupCommand, Result<GroupResponse>>(Arg.Any<UpdateGroupCommand>())
            .Returns(Result<GroupResponse>.Failure("Slug duplicado."));

        var response = await _client.PutAsJsonAsync("api/groups/1", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------
    // GET api/groups/{groupId}/members
    // ---------------------------------------------------------------

    [Fact]
    public async Task GetMembers_Existente_Returns200ConLista()
    {
        var members = new List<GroupMemberResponse>
        {
            new() { UserId = 1, Role = NitroGroups.Shared.Domain.DomainEvents.Groups.Enums.GroupMemberRole.Owner }
        };

        _mediator
            .SendQueryAsync<GetMembersRoleByIdGroupQuery, Result<List<GroupMemberResponse>>>(
                Arg.Any<GetMembersRoleByIdGroupQuery>())
            .Returns(Result<List<GroupMemberResponse>>.Success(members));

        var response = await _client.GetAsync("api/groups/1/members");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<List<GroupMemberResponse>>(ApiJsonOptions.Default);
        Assert.Single(result!);
    }

    [Fact]
    public async Task GetMembers_NoEncontrado_Returns404()
    {
        _mediator
            .SendQueryAsync<GetMembersRoleByIdGroupQuery, Result<List<GroupMemberResponse>>>(
                Arg.Any<GetMembersRoleByIdGroupQuery>())
            .Returns(Result<List<GroupMemberResponse>>.Failure("Grupo no encontrado."));

        var response = await _client.GetAsync("api/groups/9999/members");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
