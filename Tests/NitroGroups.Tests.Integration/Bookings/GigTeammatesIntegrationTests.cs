using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// T59 (S22): la agenda del músico (<c>GET api/me/gigs</c>) es el único lugar donde viajan el
/// teléfono del manager del grupo y quiénes tocan ese toque. Solo para miembros activos del grupo,
/// solo con quien confirmó, y los nombres y los instrumentos salen del contrato de Users.
/// </summary>
public class GigTeammatesIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private readonly IntegrationTestFixture _fixture;
    private readonly BookingsTestScenario _scenario = new();

    public GigTeammatesIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    private GetMyGigsQueryHandler Handler(BookingsDbContext context)
        => new(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);

    /// <summary>Guarda la respuesta como lo hace la app, por el mismo comando de asistencia.</summary>
    private Task AnswerAsync(BookingsDbContext context, EventRequest gig, long userId, string status)
        => new SetGigAttendanceCommandHandler(_fixture.CreateBookingsUnitOfWork(context), _scenario.Groups)
            .Handle(new SetGigAttendanceCommand(gig.Id, userId, status), CancellationToken.None);

    private async Task<List<GigResponse>> MyGigsAsync(BookingsDbContext context, long userId)
        => await Handler(context).Handle(new GetMyGigsQuery(userId), CancellationToken.None);

    private async Task<GigResponse> SingleAsync(BookingsDbContext context, long userId)
        => Assert.Single(await MyGigsAsync(context, userId));

    [Fact]
    public async Task MisToques_DevuelveElTelefonoDelManagerYQuienesTocan_ConNombreYRol()
    {
        await using var context = _fixture.CreateBookingsContext();
        _scenario.SetMemberships(OtherMemberId, Membership(GroupId, GroupMemberRole.Manager));
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig, MemberId, "Confirmed");
        await AnswerAsync(context, gig, OtherMemberId, "Confirmed");
        await AnswerAsync(context, gig, ManagerId, "Declined");

        var row = await SingleAsync(context, MemberId);

        Assert.Equal("33 1234 5678", row.ManagerPhone);
        // Quien confirmó toca; quien dijo que no, no toca. El llamante confirmado aparece una sola vez.
        Assert.Equal(
            [(MemberId, "Mateo Ruiz", "Member"), (OtherMemberId, "Sofía Nava", "Manager")],
            row.Teammates.Select(teammate => (teammate.UserId, teammate.FullName, teammate.Role)));
        // S22 pide el rol del grupo, no el instrumento: el instrumento vive en el equipo del grupo.
        Assert.DoesNotContain("guitarra", string.Join("|", row.Teammates.Select(teammate => teammate.Role)));
    }

    [Fact]
    public async Task MisToques_UnCompaneroQueRechazo_NoApareceEnQuienesTocan()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig, MemberId, "Confirmed");
        await AnswerAsync(context, gig, OtherMemberId, "Declined");

        var row = await SingleAsync(context, MemberId);

        Assert.Equal([MemberId], row.Teammates.Select(teammate => teammate.UserId));
        Assert.DoesNotContain(row.Teammates, teammate => teammate.UserId == OtherMemberId);
    }

    [Fact]
    public async Task MisToques_ElCompaneroQueTodaviaNoResponde_TampocoToca()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig, OtherMemberId, "Confirmed");

        var row = await SingleAsync(context, MemberId);

        // Sin respuesta no hay confirmación: la fila dice con quién toca, no a quién se le preguntó.
        Assert.Equal([OtherMemberId], row.Teammates.Select(teammate => teammate.UserId));
        Assert.Null(row.Attendance);
    }

    [Fact]
    public async Task MisToques_SinNadieConfirmado_NoHayCompaneros()
    {
        await using var context = _fixture.CreateBookingsContext();
        await SeedGigAsync(context);

        var row = await SingleAsync(context, MemberId);

        Assert.Empty(row.Teammates);
    }

    [Fact]
    public async Task MisToques_UnGrupoSinTelefonoCargado_DevuelveNuloNuncaUnaCadenaVacia()
    {
        await using var context = _fixture.CreateBookingsContext();
        _scenario.SetMemberships(OutsiderId, Membership(OtherGroupId, GroupMemberRole.Member));
        await SeedGigAsync(context, groupId: OtherGroupId);

        var row = await SingleAsync(context, OutsiderId);

        Assert.Null(row.ManagerPhone);
    }

    [Fact]
    public async Task MisToques_UnTelefonoEnBlanco_SeLeeComoNulo()
    {
        await using var context = _fixture.CreateBookingsContext();
        _scenario.GroupsById[GroupId] = Vargas with { Phone = "   " };
        await SeedGigAsync(context);

        var row = await SingleAsync(context, MemberId);

        // El formulario del grupo deja el teléfono en blanco: el contrato no manda "" y el front no
        // dibuja una etiqueta vacía.
        Assert.Null(row.ManagerPhone);
    }

    [Fact]
    public async Task MisToques_SinNombreCompleto_UsaElNombreDelPerfilDeMusicoYNuncaElCorreo()
    {
        await using var context = _fixture.CreateBookingsContext();
        _scenario.AllUsers[OtherMemberId] = new UserSummary(OtherMemberId, "sofia@vargas.mx", string.Empty, string.Empty, UserType.Musician, null);
        _scenario.Musicians[OtherMemberId] = new() { UserId = OtherMemberId, FullName = "Sofía Nava", Instruments = "violín" };
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig, OtherMemberId, "Confirmed");

        var row = await SingleAsync(context, MemberId);

        var teammate = Assert.Single(row.Teammates);
        Assert.Equal("Sofía Nava", teammate.FullName);
        Assert.DoesNotContain("@", $"{teammate.FullName}|{teammate.Role}");
    }

    [Fact]
    public async Task MisToques_ConAsistenciaPeroSinMembresiaActiva_NoDevuelveLaFilaNiElTelefono()
    {
        await using var context = _fixture.CreateBookingsContext();
        var gig = await SeedGigAsync(context);
        await AnswerAsync(context, gig, OutsiderId, "Confirmed");

        // La fila (y con ella el teléfono del grupo) solo existe para miembros activos: el contrato de
        // Groups no lista la membresía de este usuario, así que los toques del grupo ni se piden.
        Assert.Empty(await MyGigsAsync(context, OutsiderId));
    }
}
