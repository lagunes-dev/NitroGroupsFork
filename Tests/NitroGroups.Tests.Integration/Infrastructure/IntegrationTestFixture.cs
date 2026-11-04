using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Core.Bookings.Infrastructure.Repositories;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.Mappings;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Core.Schedules.Application.Abstractions;
using NitroGroups.Core.Schedules.Infrastructure;
using NitroGroups.Core.Schedules.Infrastructure.Persistence;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Core.Users.Application.Mappings;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Core.Users.Infrastructure.Repositories;
using NitroGroups.Shared.Abstractions.Events;
using NitroGroups.Shared.Infrastructure.Events;
using NitroGroups.Shared.Infrastructure.Repository;
using NSubstitute;

namespace NitroGroups.Tests.Integration.Infrastructure;

public sealed class IntegrationTestFixture : IDisposable
{
    public UsersDbContext CreateUsersContext() => CreateContext<UsersDbContext>(o => new UsersDbContext(o));
    public GroupsDbContext CreateGroupsContext() => CreateContext<GroupsDbContext>(o => new GroupsDbContext(o));
    public SchedulesDbContext CreateSchedulesContext() => CreateContext<SchedulesDbContext>(o => new SchedulesDbContext(o));
    public BookingsDbContext CreateBookingsContext() => CreateContext<BookingsDbContext>(o => new BookingsDbContext(o));

    private static TContext CreateContext<TContext>(Func<DbContextOptions<TContext>, TContext> factory)
        where TContext : DbContext
    {
        var options = new DbContextOptionsBuilder<TContext>()
            .UseInMemoryDatabase($"NitroGroupsTests_{Guid.NewGuid():N}")
            .EnableSensitiveDataLogging()
            .Options;

        var context = factory(options);
        context.Database.EnsureCreated();
        return context;
    }

    public IMapper CreateMapper()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(cfg =>
        {
            cfg.AddProfile<UserProfile>();
            cfg.AddProfile<MusicianProfile>();
            cfg.AddProfile<GroupProfile>();
        });

        using var provider = services.BuildServiceProvider();
        return provider.GetRequiredService<IMapper>();
    }

    public IUnitOfWorkUser CreateUsersUnitOfWork(UsersDbContext context)
        => CreateUsersUnitOfWork(context, Substitute.For<IOutboxService>());

    public IUnitOfWorkUser CreateUsersUnitOfWork(UsersDbContext context, IOutboxService outbox)
        => new UnitOfWorkUser(
            context,
            outbox,
            new GenericRepository<User, long>(context),
            new GenericRepository<Musician, long>(context),
            new OpenMusicianSearchRepository(context));

    public IUnitOfWorkGroups CreateGroupsUnitOfWork(GroupsDbContext context)
        => new UnitOfWorkGroups(
            context,
            Substitute.For<IOutboxService>(),
            new GenericRepository<Group, long>(context),
            new GenericRepository<GroupMember, long>(context),
            new GenericRepository<MusicGenre, long>(context),
            new GenericRepository<GroupGenre, long>(context),
            new GenericRepository<GroupMedia, long>(context),
            new Core.Groups.Infrastructure.Repositories.GroupSearchRepository(context));

    public IUnitOfWorkSchedules CreateSchedulesUnitOfWork(SchedulesDbContext context)
    {
        var services = new ServiceCollection();
        services.AddSingleton(context);
        services.AddSchedulesRepositories();

        return services.BuildServiceProvider().GetRequiredService<IUnitOfWorkSchedules>();
    }

    public IUnitOfWorkBookings CreateBookingsUnitOfWork(BookingsDbContext context)
        => CreateBookingsUnitOfWork(context, Substitute.For<IOutboxService>());

    public IUnitOfWorkBookings CreateBookingsUnitOfWork(BookingsDbContext context, IOutboxService outbox)
        => new UnitOfWorkBookings(context, outbox, new EventRequestRepository(context));

    /// <summary>Outbox real sobre el contexto de Bookings: guarda los eventos en outbox_events.</summary>
    public IOutboxService CreateBookingsOutbox(BookingsDbContext context)
        => new OutboxService<BookingsDbContext>(
            context,
            NullLogger<OutboxService<BookingsDbContext>>.Instance,
            Substitute.For<IServiceProvider>(),
            Substitute.For<IEventProvider>());

    public void Dispose()
    {
    }
}
