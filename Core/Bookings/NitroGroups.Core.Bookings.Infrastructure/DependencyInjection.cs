using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Core.Bookings.Infrastructure.Repositories;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.Infrastructure.Persistence;

namespace NitroGroups.Core.Bookings.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddBookingsInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddModuleDbContext<BookingsDbContext>(configuration, BookingsDbContext.SchemaName);
        services.AddBookingsRepositories();

        services.AddScoped<IBookingsModuleApi, Adapters.BookingsModuleApi>();

        services.AddEndpoints(typeof(DependencyInjection).Assembly);

        return services;
    }

    /// <summary>Repositorios y UnitOfWork del módulo (sin DbContext; útil para tests).</summary>
    public static IServiceCollection AddBookingsRepositories(this IServiceCollection services)
    {
        services.AddScoped<IEventRequestRepository, EventRequestRepository>();
        services.AddScoped<IGigAttendanceRepository, GigAttendanceRepository>();
        services.AddScoped<IGigPayRepository, GigPayRepository>();
        services.AddModuleUnitOfWork<IUnitOfWorkBookings, UnitOfWorkBookings, BookingsDbContext>();
        return services;
    }
}
