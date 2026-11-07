using System.Text.Json;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetBySlug;
using NitroGroups.Core.Groups.Application.UseCases.Groups.GetByUserId;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Update;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// Ronda 9, "cómo pagar": el grupo escribe cómo quiere que se le pague (texto libre, tope de 500) y
/// solo el cliente de un evento aceptado lo lee. La app no cobra ni mueve dinero (D1/S18).
/// Estas pruebas fijan cuatro reglas del lado de Groups: el manager lo guarda y lo borra, el
/// contrato del módulo normaliza el vacío a null (como el teléfono), la lectura del manager lo lleva
/// y el perfil público no lo lleva.
/// </summary>
public class PaymentInstructionsIntegrationTests : IClassFixture<IntegrationTestFixture>, IAsyncDisposable
{
    private const long OwnerId = 10;
    private static readonly DateTime FiledAt = new(2026, 11, 5, 18, 0, 0, DateTimeKind.Utc);

    private readonly IntegrationTestFixture _fixture;
    private readonly GroupsDbContext _context;

    public PaymentInstructionsIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
        _context = fixture.CreateGroupsContext();
    }

    // ---------------------------------------------------------------------
    // El manager lo guarda, lo corrige y lo borra
    // ---------------------------------------------------------------------

    [Fact]
    public async Task Guardar_ElTextoQuedaPersistidoConSuFecha()
    {
        var groupId = await SeedGroupAsync(instructions: null);

        var result = await UpdateHandler().Handle(
            Command(groupId, "Transfiere a la CLABE 0121 8000 1234 5678, BBVA, Mónica Salinas."), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var persisted = await ReloadAsync(groupId);
        Assert.Equal("Transfiere a la CLABE 0121 8000 1234 5678, BBVA, Mónica Salinas.", persisted.PaymentInstructions);
        Assert.NotNull(persisted.PaymentInstructionsUpdatedAt);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Borrar_DejaNullYSeLlevaLaFecha(string blank)
    {
        var groupId = await SeedGroupAsync(instructions: "Efectivo en la oficina.");

        var result = await UpdateHandler().Handle(Command(groupId, blank), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var persisted = await ReloadAsync(groupId);
        // El campo vacío es cómo el grupo dice "no lo cargué": no queda una cadena en blanco guardada.
        Assert.Null(persisted.PaymentInstructions);
        Assert.Null(persisted.PaymentInstructionsUpdatedAt);
    }

    [Fact]
    public async Task GuardarElMismoTextoOtraVez_NoMueveLaFecha()
    {
        var groupId = await SeedGroupAsync(instructions: "Efectivo en la oficina.");

        await UpdateHandler().Handle(Command(groupId, "Efectivo en la oficina."), CancellationToken.None);

        // Editar otra cosa del perfil no reescribe cuándo cambió cómo pagar: la fecha es del texto.
        Assert.Equal(FiledAt, (await ReloadAsync(groupId)).PaymentInstructionsUpdatedAt);
    }

    [Fact]
    public async Task CorregirElTexto_MueveLaFecha()
    {
        var groupId = await SeedGroupAsync(instructions: "Efectivo.");

        await UpdateHandler().Handle(Command(groupId, "Transferencia a la CLABE 0121 8000 1234 5678."), CancellationToken.None);

        var persisted = await ReloadAsync(groupId);
        Assert.Equal("Transferencia a la CLABE 0121 8000 1234 5678.", persisted.PaymentInstructions);
        Assert.True(persisted.PaymentInstructionsUpdatedAt > FiledAt);
    }

    [Fact]
    public async Task ElRecorteDelTexto_SeGuardaSinEspaciosEnLasOrillas()
    {
        var groupId = await SeedGroupAsync(instructions: null);

        await UpdateHandler().Handle(Command(groupId, "  Efectivo el día del toque.  "), CancellationToken.None);

        Assert.Equal("Efectivo el día del toque.", (await ReloadAsync(groupId)).PaymentInstructions);
    }

    // ---------------------------------------------------------------------
    // El contrato del módulo: normaliza el vacío a null, como el teléfono
    // ---------------------------------------------------------------------

    [Theory]
    [InlineData("Efectivo en la oficina.", "Efectivo en la oficina.")]
    [InlineData("  Efectivo en la oficina.  ", "Efectivo en la oficina.")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    public async Task GetPaymentInstructionsAsync_NuncaDevuelveUnaCadenaEnBlanco(string stored, string? expectedText)
    {
        var groupId = await SeedGroupAsync(instructions: null, storedInstructions: stored);

        var instructions = await new GroupsModuleApi(_context).GetPaymentInstructionsAsync(groupId);

        Assert.Equal(expectedText, instructions?.Text);
    }

    [Fact]
    public async Task GetPaymentInstructionsAsync_LlevaLaFechaDelTexto()
    {
        var groupId = await SeedGroupAsync(instructions: "Efectivo.");

        var instructions = await new GroupsModuleApi(_context).GetPaymentInstructionsAsync(groupId);

        Assert.NotNull(instructions);
        Assert.Equal("Efectivo.", instructions!.Text);
        Assert.Equal(FiledAt, instructions.UpdatedAt);
    }

    [Fact]
    public async Task GetPaymentInstructionsAsync_SinTextoEnElGrupo_EsNull()
    {
        var sinTexto = await SeedGroupAsync(instructions: null);

        Assert.Null(await new GroupsModuleApi(_context).GetPaymentInstructionsAsync(sinTexto));
        Assert.Null(await new GroupsModuleApi(_context).GetPaymentInstructionsAsync(9_999));
    }

    // ---------------------------------------------------------------------
    // La lectura del manager lo lleva; el perfil público no
    // ---------------------------------------------------------------------

    [Fact]
    public async Task LaLecturaDelManager_LlevaElTextoQueElClienteLeeraDespues()
    {
        var groupId = await SeedGroupAsync(instructions: "Efectivo en la oficina.");
        await AddOwnerMembershipAsync(groupId);

        var users = Substitute.For<IUsersModuleApi>();
        users.GetUserAsync(OwnerId, Arg.Any<CancellationToken>())
            .Returns(new UserSummary(OwnerId, "manager@vargas.mx", "Pedro", "Vargas", UserType.Musician, null));

        var result = await new GetGroupByUserIdQueryHandler(
                _fixture.CreateGroupsUnitOfWork(_context), _fixture.CreateMapper(), users)
            .Handle(new GetGroupByUserIdQuery(OwnerId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        // Sin este campo el manager no puede cargar ni corregir lo que el cliente lee.
        Assert.Equal("Efectivo en la oficina.", result.Value!.PaymentInstructions);
    }

    [Fact]
    public async Task ElPerfilPublico_EnJson_NoLlevaComoPagar()
    {
        var groupId = await SeedGroupAsync(instructions: "Transfiere a la CLABE 0121 8000 1234 5678.");
        var slug = (await _context.Groups.FindAsync(groupId))!.Slug;

        var result = await new GetGroupBySlugQueryHandler(_fixture.CreateGroupsUnitOfWork(_context), _fixture.CreateMapper())
            .Handle(new GetGroupBySlugQuery(slug), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Error);
        var payload = JsonSerializer.Serialize(result.Value, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        using var json = JsonDocument.Parse(payload);

        // El visitante anónimo no lee cómo pagar: es un acuerdo entre el grupo y su cliente, y una
        // respuesta que no declara el campo lo garantiza también en el JSON.
        Assert.False(json.RootElement.TryGetProperty("paymentInstructions", out _));
        Assert.DoesNotContain(typeof(PublicGroupResponse).GetProperties(), property => property.Name.Contains("Payment"));
    }

    // ---------------------------------------------------------------------
    // Andamiaje
    // ---------------------------------------------------------------------

    private UpdateGroupCommandHandler UpdateHandler()
        => new(_fixture.CreateGroupsUnitOfWork(_context), _fixture.CreateMapper());

    private async Task<long> SeedGroupAsync(string? instructions, string? storedInstructions = null)
    {
        var group = new Group
        {
            OwnerUserId = OwnerId,
            Slug = $"los-test-{Guid.NewGuid():N}",
            GroupName = "Los Test",
            Email = "grupo@test.mx",
            Active = true
        };
        group.SetPaymentInstructions(storedInstructions ?? instructions, FiledAt);

        _context.Groups.Add(group);
        await _context.SaveChangesAsync();
        return group.Id;
    }

    private async Task AddOwnerMembershipAsync(long groupId)
    {
        _context.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = OwnerId,
            Role = GroupMemberRole.Owner,
            IsActive = true,
            JoinedAt = DateTime.UtcNow.AddDays(-30),
            JoinedVia = JoinedVia.Manual
        });
        await _context.SaveChangesAsync();
    }

    /// <summary>El valor guardado, leído de nuevo desde la base en memoria.</summary>
    private async Task<Group> ReloadAsync(long groupId)
    {
        var group = (await _context.Groups.FindAsync(groupId))!;
        await _context.Entry(group).ReloadAsync();
        return group;
    }

    /// <summary>Un guardado del manager: solo cambia cómo pagar, el resto queda como estaba.</summary>
    private static UpdateGroupCommand Command(long groupId, string? instructions) => new(
        groupId,
        "los-test",
        "Los Test",
        "Descripción",
        "Biografía",
        4,
        5,
        "33 1234 5678",
        "grupo@test.mx",
        "Guadalajara",
        50,
        "MXN",
        12_000m,
        null,
        2,
        30,
        true,
        null,
        null,
        instructions);

    public async ValueTask DisposeAsync() => await _context.DisposeAsync();
}
