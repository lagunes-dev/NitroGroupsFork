using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cortex.Mediator;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetByUserId;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetBySlug;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Update;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Requests;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Tests.Endpoints.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Endpoints.Groups;

/// <summary>
/// Ronda 9, "cómo pagar", en el borde HTTP: el perfil público <b>no</b> lleva el campo (se fija el
/// conjunto exacto de propiedades del JSON anónimo), la lectura del manager sí lo lleva, y el
/// guardado respeta el tope de 500 con un 400 que se puede corregir en el formulario.
/// </summary>
public class PaymentInstructionsGroupEndpointsTests(NitroGroupsWebAppFactory factory) : IClassFixture<NitroGroupsWebAppFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly IMediator _mediator = factory.Mediator;

    /// <summary>Las propiedades del perfil público, en orden. Cómo pagar no está y no puede estar.</summary>
    private static readonly string[] PublicProfileProperties =
    [
        "id", "ownerUserId", "slug", "groupName", "description", "biography", "numMembers", "yearsExperience",
        "phone", "email", "locationText", "serviceRadiusKm", "currency", "basePrice", "hourlyRate",
        "minimumDurationHours", "setupTimeMinutes", "averageRating", "totalReviews", "viewCount",
        "bookingCount", "isVerified", "isFeatured", "isAcceptingBookings", "active", "profilePictureUrl",
        "coverImageUrl", "genres", "media"
    ];

    [Fact]
    public async Task ElPerfilPublico_NoLlevaComoPagar_EnSuJson()
    {
        _mediator
            .SendQueryAsync<GetGroupBySlugQuery, Result<PublicGroupResponse>>(Arg.Any<GetGroupBySlugQuery>())
            .Returns(Result<PublicGroupResponse>.Success(new PublicGroupResponse
            {
                Id = 1,
                Slug = "los-rockers",
                GroupName = "Los Rockers",
                OwnerUserId = 10,
                Email = "grupo@rockers.mx",
                Active = true
            }));

        var response = await _client.GetAsync("api/groups/slug/los-rockers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

        // El visitante anónimo no lee cómo pagar: es un acuerdo entre el grupo y su cliente.
        Assert.Equal(PublicProfileProperties, json.RootElement.EnumerateObject().Select(property => property.Name));
        Assert.False(json.RootElement.TryGetProperty("paymentInstructions", out _));
    }

    [Fact]
    public async Task LaLecturaDelManager_SiLlevaComoPagar()
    {
        _mediator
            .SendQueryAsync<GetGroupByUserIdQuery, Result<GroupResponse?>>(Arg.Any<GetGroupByUserIdQuery>())
            .Returns(Result<GroupResponse?>.Success(new GroupResponse
            {
                Id = 1,
                Slug = "los-rockers",
                GroupName = "Los Rockers",
                PaymentInstructions = "Efectivo en la oficina, el día del toque."
            }));

        var response = await _client.GetAsync("api/users/10/groups");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        // Sin este campo en su propia lectura, el manager no puede cargar lo que el cliente lee.
        Assert.Equal(
            "Efectivo en la oficina, el día del toque.",
            json.RootElement.GetProperty("paymentInstructions").GetString());
    }

    [Fact]
    public async Task Guardado_ConMasDe500Caracteres_Returns400SinLlamarAlHandler()
    {
        var request = new UpdateGroupRequest
        {
            Slug = "los-rockers",
            GroupName = "Los Rockers",
            Currency = "MXN",
            PaymentInstructions = new string('x', 501)
        };

        var response = await _client.PutAsJsonAsync("api/groups/1", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Cómo pagar no puede pasar de 500 caracteres.", await response.Content.ReadAsStringAsync());
        await _mediator.DidNotReceive()
            .SendCommandAsync<UpdateGroupCommand, Result<GroupResponse>>(Arg.Any<UpdateGroupCommand>());
    }

    [Fact]
    public async Task Guardado_Con500Caracteres_LlegaAlHandler()
    {
        var limit = new string('x', 500);
        _mediator
            .SendCommandAsync<UpdateGroupCommand, Result<GroupResponse>>(Arg.Any<UpdateGroupCommand>())
            .Returns(Result<GroupResponse>.Success(new GroupResponse { Id = 1, Slug = "los-rockers", PaymentInstructions = limit }));

        var response = await _client.PutAsJsonAsync("api/groups/1", new UpdateGroupRequest
        {
            Slug = "los-rockers",
            GroupName = "Los Rockers",
            Currency = "MXN",
            PaymentInstructions = limit
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await _mediator.Received()
            .SendCommandAsync<UpdateGroupCommand, Result<GroupResponse>>(
                Arg.Is<UpdateGroupCommand>(command => command.PaymentInstructions == limit));
    }
}
