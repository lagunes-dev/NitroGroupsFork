using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Search;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;
using NitroGroups.Tests.Integration.Bookings;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Integration.Groups;

public class SearchGroupsQueryHandlerIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private static readonly ISchedulesModuleApi NoSchedules = Substitute.For<ISchedulesModuleApi>();

    /// <summary>A group nobody booked: the default answer of the Bookings contract.</summary>
    private static readonly IBookingsModuleApi NoBookings = EmptyBookings();

    private static IBookingsModuleApi EmptyBookings()
    {
        var bookings = Substitute.For<IBookingsModuleApi>();
        bookings.GetBusyGroupIdsAsync(Arg.Any<IReadOnlyCollection<long>>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<long>());
        return bookings;
    }

    private async Task<(GroupsDbContext Context, Dictionary<string, long> Ids)> SeedAsync()
    {
        var context = fixture.CreateGroupsContext();
        var mariachi = new MusicGenre { Name = "Mariachi", Slug = "mariachi" };
        var rock = new MusicGenre { Name = "Rock en español", Slug = "rock-en-espanol" };
        context.MusicGenres.AddRange(mariachi, rock);

        Group G(string name, string city, decimal? price, bool active = true, bool accepting = true, decimal rating = 0) => new()
        {
            Slug = name.ToLowerInvariant().Replace(' ', '-'), GroupName = name, Description = $"{name} para tu evento",
            LocationText = city, BasePrice = price, Active = active, IsAcceptingBookings = accepting, AverageRating = rating, Currency = "MXN",
        };

        var vargas = G("Mariachi Vargas", "Guadalajara, Jalisco", 18000, rating: 4.9m);
        var aurora = G("Mariachi Aurora", "Ciudad de México", 9000, rating: 4.5m);
        var rockers = G("Los Rockers", "Ciudad de México", null);
        var inactivo = G("Mariachi Inactivo", "Ciudad de México", 5000, active: false);
        var lleno = G("Mariachi Sin Fechas", "Ciudad de México", 5000, accepting: false);
        context.Groups.AddRange(vargas, aurora, rockers, inactivo, lleno);
        await context.SaveChangesAsync();

        context.GroupGenres.AddRange(
            new GroupGenre { GroupId = vargas.Id, GenreId = mariachi.Id, IsPrimary = true },
            new GroupGenre { GroupId = aurora.Id, GenreId = mariachi.Id, IsPrimary = true },
            new GroupGenre { GroupId = rockers.Id, GenreId = rock.Id, IsPrimary = true });
        context.GroupMedia.Add(new GroupMedia { GroupId = aurora.Id, Type = MediaType.Photo, Url = "https://cdn/aurora.jpg", IsPrimary = true });
        await context.SaveChangesAsync();

        return (context, new() { ["vargas"] = vargas.Id, ["aurora"] = aurora.Id, ["rockers"] = rockers.Id });
    }

    private SearchGroupsQueryHandler Handler(
        GroupsDbContext context,
        ISchedulesModuleApi? schedules = null,
        IBookingsModuleApi? bookings = null) =>
        new(fixture.CreateGroupsUnitOfWork(context), schedules ?? NoSchedules, bookings ?? NoBookings);

    [Fact]
    public async Task SinFiltros_DevuelveSoloActivosQueAceptanReservas_OrdenadosPorCalificacion()
    {
        var (context, _) = await SeedAsync();

        var result = await Handler(context).Handle(new SearchGroupsQuery(null, null, null, null, null), default);

        Assert.Equal(["Mariachi Vargas", "Mariachi Aurora", "Los Rockers"], result.Items.Select(i => i.GroupName));
        Assert.Equal(3, result.TotalCount);
    }

    [Theory]
    [InlineData("vargas", null, null, null, new[] { "Mariachi Vargas" })]
    [InlineData("ROCK", null, null, null, new[] { "Los Rockers" })]           // texto en el nombre del género, sin importar mayúsculas
    [InlineData(null, "mariachi", null, null, new[] { "Mariachi Vargas", "Mariachi Aurora" })]
    [InlineData(null, null, "guadalajara", null, new[] { "Mariachi Vargas" })]
    [InlineData(null, null, null, 10000d, new[] { "Mariachi Aurora" })]      // sin precio publicado no entra en un presupuesto
    public async Task Filtra(string? q, string? genre, string? city, double? maxPrice, string[] expected)
    {
        var (context, _) = await SeedAsync();

        var result = await Handler(context).Handle(
            new SearchGroupsQuery(q, genre, city, (decimal?)maxPrice, null), default);

        Assert.Equal(expected, result.Items.Select(i => i.GroupName));
    }

    [Fact]
    public async Task ConFecha_ExcluyeLosGruposNoDisponiblesEseDia()
    {
        var (context, ids) = await SeedAsync();
        var schedules = Substitute.For<ISchedulesModuleApi>();
        schedules.GetUnavailableGroupIdsAsync(Arg.Any<IReadOnlyCollection<long>>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<long> { ids["vargas"] });

        var result = await Handler(context, schedules).Handle(
            new SearchGroupsQuery(null, "mariachi", null, null, new DateOnly(2026, 12, 12)), default);

        Assert.Equal(["Mariachi Aurora"], result.Items.Select(i => i.GroupName));
        var (from, to) = SearchGroupsQueryHandler.LocalDay(new DateOnly(2026, 12, 12));
        await schedules.Received(1).GetUnavailableGroupIdsAsync(
            Arg.Is<IReadOnlyCollection<long>>(c => c.Count == 2), from, to, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ConFecha_ExcluyeElGrupoQueYaTieneUnEventoAceptadoEseDia_YCuentaSoloLosQueQuedan()
    {
        var (context, ids) = await SeedAsync();
        var day = new DateOnly(2026, 11, 19);
        await using var bookingsContext = fixture.CreateBookingsContext();
        await BookingsTestScenario.SeedAsync(
            bookingsContext, groupId: ids["rockers"], eventDate: day,
            configure: request => request.Accept(null, DateTime.UtcNow));

        var result = await Handler(context, bookings: new BookingsModuleApi(bookingsContext))
            .Handle(new SearchGroupsQuery(null, null, null, null, day), default);

        Assert.Equal(["Mariachi Vargas", "Mariachi Aurora"], result.Items.Select(i => i.GroupName));
        Assert.Equal(2, result.TotalCount);
        Assert.Equal(result.Items.Count, result.TotalCount);
    }

    [Theory]
    [InlineData(EventRequestStatus.Pending)]
    [InlineData(EventRequestStatus.Declined)]
    [InlineData(EventRequestStatus.Cancelled)]
    public async Task ConFecha_UnSolicitudNoAceptadaEseDia_NoOcultaElGrupo(EventRequestStatus status)
    {
        var (context, ids) = await SeedAsync();
        var day = new DateOnly(2026, 11, 19);
        await using var bookingsContext = fixture.CreateBookingsContext();
        await BookingsTestScenario.SeedAsync(
            bookingsContext, groupId: ids["rockers"], eventDate: day,
            configure: request => MoveTo(request, status));

        var result = await Handler(context, bookings: new BookingsModuleApi(bookingsContext))
            .Handle(new SearchGroupsQuery(null, null, null, null, day), default);

        Assert.Equal(["Mariachi Vargas", "Mariachi Aurora", "Los Rockers"], result.Items.Select(i => i.GroupName));
        Assert.Equal(3, result.TotalCount);
    }

    [Fact]
    public async Task ConFecha_UnEventoAceptadoOtroDia_NoOcultaElGrupo()
    {
        var (context, ids) = await SeedAsync();
        await using var bookingsContext = fixture.CreateBookingsContext();
        await BookingsTestScenario.SeedAsync(
            bookingsContext, groupId: ids["rockers"], eventDate: new DateOnly(2026, 11, 20),
            configure: request => request.Accept(null, DateTime.UtcNow));

        var result = await Handler(context, bookings: new BookingsModuleApi(bookingsContext))
            .Handle(new SearchGroupsQuery(null, null, null, null, new DateOnly(2026, 11, 19)), default);

        Assert.Equal(["Mariachi Vargas", "Mariachi Aurora", "Los Rockers"], result.Items.Select(i => i.GroupName));
        Assert.Equal(3, result.TotalCount);
    }

    [Fact]
    public async Task SinFecha_DevuelveLosMismosGruposQueAntes_YNoPreguntaPorReservas()
    {
        var (context, ids) = await SeedAsync();
        var day = new DateOnly(2026, 11, 19);
        var bookings = Substitute.For<IBookingsModuleApi>();
        bookings.GetBusyGroupIdsAsync(Arg.Any<IReadOnlyCollection<long>>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<long> { ids["vargas"], ids["aurora"], ids["rockers"] });
        await using var bookingsContext = fixture.CreateBookingsContext();
        await BookingsTestScenario.SeedAsync(
            bookingsContext, groupId: ids["rockers"], eventDate: day,
            configure: request => request.Accept(null, DateTime.UtcNow));

        var result = await Handler(context, bookings: bookings)
            .Handle(new SearchGroupsQuery(null, null, null, null, null), default);

        Assert.Equal(["Mariachi Vargas", "Mariachi Aurora", "Los Rockers"], result.Items.Select(i => i.GroupName));
        Assert.Equal(3, result.TotalCount);
        await bookings.DidNotReceive().GetBusyGroupIdsAsync(
            Arg.Any<IReadOnlyCollection<long>>(), Arg.Any<DateOnly>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ConFecha_ExcluyeLosOcupadosPorHorarioYLosQueYaTienenUnEventoAceptado()
    {
        var (context, ids) = await SeedAsync();
        var day = new DateOnly(2026, 11, 19);
        var schedules = Substitute.For<ISchedulesModuleApi>();
        schedules.GetUnavailableGroupIdsAsync(Arg.Any<IReadOnlyCollection<long>>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<long> { ids["vargas"] });
        await using var bookingsContext = fixture.CreateBookingsContext();
        await BookingsTestScenario.SeedAsync(
            bookingsContext, groupId: ids["rockers"], eventDate: day,
            configure: request => request.Accept(null, DateTime.UtcNow));

        var result = await Handler(context, schedules, new BookingsModuleApi(bookingsContext))
            .Handle(new SearchGroupsQuery(null, null, null, null, day), default);

        Assert.Equal(["Mariachi Aurora"], result.Items.Select(i => i.GroupName));
        Assert.Equal(1, result.TotalCount);
    }

    /// <summary>Puts a seeded request in the given status, through its own domain transitions.</summary>
    private static void MoveTo(EventRequest request, EventRequestStatus status)
    {
        var now = DateTime.UtcNow;
        switch (status)
        {
            case EventRequestStatus.Accepted:
                request.Accept(null, now);
                break;
            case EventRequestStatus.Declined:
                request.Decline(null, now);
                break;
            case EventRequestStatus.Cancelled:
                request.Cancel(EventRequestParty.Client);
                break;
        }
    }

    [Fact]
    public void ElDiaDelEventoSeInterpretaEnHoraDeMexico()
    {
        var (from, to) = SearchGroupsQueryHandler.LocalDay(new DateOnly(2026, 12, 12));

        Assert.Equal(new DateTimeOffset(2026, 12, 12, 6, 0, 0, TimeSpan.Zero), from.ToUniversalTime());
        Assert.Equal(TimeSpan.FromHours(24), to - from);
    }

    [Fact]
    public async Task Pagina_YUsaLaFotoPrincipalComoImagen()
    {
        var (context, _) = await SeedAsync();

        var page2 = await Handler(context).Handle(new SearchGroupsQuery(null, null, null, null, null, Page: 2, Size: 1), default);

        var item = Assert.Single(page2.Items);
        Assert.Equal("Mariachi Aurora", item.GroupName);
        Assert.Equal("https://cdn/aurora.jpg", item.ImageUrl);
        Assert.Equal(["Mariachi"], item.Genres);
        Assert.Equal(3, page2.TotalPages);
    }

    [Fact]
    public async Task TamanoDePagina_SeAcotaAlMaximo()
    {
        var (context, _) = await SeedAsync();

        var result = await Handler(context).Handle(new SearchGroupsQuery(null, null, null, null, null, Page: 0, Size: 1000), default);

        Assert.Equal(SearchGroupsQueryHandler.MaxPageSize, result.PageSize);
        Assert.Equal(1, result.PageNumber);
    }

    [Fact]
    public async Task PaginaEnorme_DevuelvePaginaVacia_SinError()
    {
        var (context, _) = await SeedAsync();

        var result = await Handler(context).Handle(new SearchGroupsQuery(null, null, null, null, null, Page: int.MaxValue, Size: 48), default);

        Assert.Empty(result.Items);
        Assert.Equal(3, result.TotalCount);
    }

    [Fact]
    public async Task Empates_SeOrdenanDeFormaEstablePorId()
    {
        await using var context = fixture.CreateGroupsContext();
        for (var i = 0; i < 4; i++)
            context.Groups.Add(new Group { Slug = $"igual-{i}", GroupName = "Mismo Nombre", Active = true, IsAcceptingBookings = true });
        await context.SaveChangesAsync();
        var handler = Handler(context);

        var paginas = new List<long>();
        for (var p = 1; p <= 4; p++)
            paginas.AddRange((await handler.Handle(new SearchGroupsQuery(null, null, null, null, null, p, 1), default)).Items.Select(i => i.Id));

        Assert.Equal(paginas.Order(), paginas);
        Assert.Equal(4, paginas.Distinct().Count());
    }
}
