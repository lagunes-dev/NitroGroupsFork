using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using NitroGroups.Core.Bookings.Application;
using NitroGroups.Core.Bookings.Application.Events;
using NitroGroups.Core.Bookings.Application.UseCases.Reviews;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.Events;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Bookings;
using NitroGroups.Shared.Infrastructure.Events;
using NitroGroups.Tests.Integration.Bookings;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// L5 (D7): la reseña que guarda Bookings viaja por su outbox y un handler de Groups actualiza
/// el agregado del perfil de forma incremental. Mismo camino que los eventos de Usuarios.
/// </summary>
public class GroupReviewPostedEventHandlerIntegrationTests(IntegrationTestFixture fixture)
    : IClassFixture<IntegrationTestFixture>
{
    private static readonly IConfiguration Configuration = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            // Solo se usa para construir los servicios: este test nunca abre una conexión.
            ["ConnectionStrings:NitroGroupsConnection"] = "Host=localhost;Database=nitrogroups_tests;Username=none"
        })
        .Build();

    private readonly IntegrationTestFixture _fixture = fixture;
    private readonly BookingsTestScenario _scenario = new();

    /// <summary>
    /// Arma el outbox real de Bookings con el contenedor de la API (Bookings + Groups) para que
    /// el despacho resuelva el handler de Groups, igual que en producción. El contenedor no se
    /// libera: al liberarse dispondría el UnitOfWork del test, que es de afuera.
    /// </summary>
    private static OutboxService<BookingsDbContext> CreateOutbox(
        BookingsDbContext bookingsContext,
        IUnitOfWorkGroups groupsUnitOfWork)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddBookingsApplication(Configuration);
        services.AddGroupsApplication(Configuration);
        services.AddGroupsInfrastructure(Configuration);
        services.RemoveAll<IUnitOfWorkGroups>();
        // Singleton a propósito: el alcance por evento del outbox no debe disponer el contexto del test.
        services.AddSingleton(_ => groupsUnitOfWork);
        var provider = services.BuildServiceProvider();

        var eventProvider = new EventProvider();
        eventProvider.RegisterEventsFromAssembly(typeof(BookingEvents).Assembly);
        eventProvider.RegisterEventsFromAssembly(typeof(BookingsEvents).Assembly);

        return new OutboxService<BookingsDbContext>(
            bookingsContext,
            NullLogger<OutboxService<BookingsDbContext>>.Instance,
            provider,
            eventProvider);
    }

    private static async Task<Group> AddGroupAsync(
        GroupsDbContext context,
        decimal averageRating = 0m,
        int totalReviews = 0,
        long? id = null)
    {
        var group = new Group
        {
            Id = id ?? 0,
            OwnerUserId = ManagerId,
            Slug = $"los-vargas-{Guid.NewGuid():N}",
            GroupName = "Los Vargas",
            Email = "grupo@vargas.mx",
            Currency = "MXN",
            AverageRating = averageRating,
            TotalReviews = totalReviews,
            Active = true
        };
        context.Groups.Add(group);
        await context.SaveChangesAsync();
        return group;
    }

    [Fact]
    public async Task ElEventoDelOutbox_ActualizaElAgregadoDelGrupoDeFormaIncremental()
    {
        await using var groupsContext = _fixture.CreateGroupsContext();
        var group = await AddGroupAsync(groupsContext, averageRating: 4.00m, totalReviews: 3);
        await using var bookingsContext = _fixture.CreateBookingsContext();
        var outbox = CreateOutbox(bookingsContext, _fixture.CreateGroupsUnitOfWork(groupsContext));

        await outbox.SaveEventAsync(new GroupReviewPostedEvent { GroupId = group.Id, Rating = 5 });
        await outbox.ProcessPendingEventsAsync();

        var saved = await groupsContext.Groups.SingleAsync(g => g.Id == group.Id);
        Assert.Equal(4, saved.TotalReviews);
        Assert.Equal(4.25m, saved.AverageRating); // (4.00 * 3 + 5) / 4

        var row = Assert.Single(bookingsContext.OutboxEvents.ToList());
        Assert.True(row.Processed, row.LastError);
    }

    [Fact]
    public async Task ElPrimerEvento_SobreUnGrupoSinResenasDejaElPromedioEnLaCalificacion()
    {
        await using var groupsContext = _fixture.CreateGroupsContext();
        var group = await AddGroupAsync(groupsContext);
        await using var bookingsContext = _fixture.CreateBookingsContext();
        var outbox = CreateOutbox(bookingsContext, _fixture.CreateGroupsUnitOfWork(groupsContext));

        await outbox.SaveEventAsync(new GroupReviewPostedEvent { GroupId = group.Id, Rating = 3 });
        await outbox.ProcessPendingEventsAsync();

        var saved = await groupsContext.Groups.SingleAsync(g => g.Id == group.Id);
        Assert.Equal(1, saved.TotalReviews);
        Assert.Equal(3.00m, saved.AverageRating);
    }

    [Fact]
    public async Task UnaResenaRealDelClienteLlegaAlAgregadoDelGrupoPorElOutbox()
    {
        await using var bookingsContext = _fixture.CreateBookingsContext();
        var gig = await SeedAsync(bookingsContext, eventDate: new DateOnly(2026, 10, 20), configure: request =>
        {
            request.Accept(null, Now.UtcDateTime);
        });
        var bookingsOutbox = _fixture.CreateBookingsOutbox(bookingsContext);
        var created = await new PostEventReviewCommandHandler(
                _fixture.CreateBookingsUnitOfWork(bookingsContext, bookingsOutbox), _scenario.Time)
            .Handle(new PostEventReviewCommand(gig.Id, ClientId, 5, "Inolvidables"), CancellationToken.None);
        Assert.True(created.IsSuccess, created.Error);

        await using var groupsContext = _fixture.CreateGroupsContext();
        await AddGroupAsync(groupsContext, id: GroupId); // el grupo de la reseña es el 10
        var outbox = CreateOutbox(bookingsContext, _fixture.CreateGroupsUnitOfWork(groupsContext));
        await outbox.ProcessPendingEventsAsync();

        var saved = await groupsContext.Groups.SingleAsync(g => g.Id == GroupId);
        Assert.Equal(1, saved.TotalReviews);
        Assert.Equal(5.00m, saved.AverageRating);
        var row = Assert.Single(bookingsContext.OutboxEvents.ToList());
        Assert.True(row.Processed, row.LastError);
    }
}
