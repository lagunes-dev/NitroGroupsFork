using Cortex.Mediator.Notifications;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Core.Users.Application.Abstractions.Services;
using NitroGroups.Core.Users.Application.EventHandlers;
using NitroGroups.Core.Users.Application.Events;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Adapters;
using NitroGroups.Core.Users.Infrastructure.Auth;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Core.Users.Infrastructure.Services;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.Infrastructure.Persistence;

namespace NitroGroups.Core.Users.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddUsersInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddModuleDbContext<UsersDbContext>(configuration, UsersDbContext.SchemaName);
            services.AddUsersRepositories();

            services.AddScoped<IUsersModuleApi, UsersModuleApi>();
            services.AddMemoryCache();
            services.AddScoped<Microsoft.AspNetCore.Authentication.IClaimsTransformation, NitroClaimsTransformation>();
            services.AddScoped<IAuthenticationService, AuthenticationService>();

            services.AddScoped<INotificationHandler<UserEvents.UserCreatedDomainEvent>, UserCreatedDomainEventHandler>();

            services.AddEndpoints(typeof(DependencyInjection).Assembly);

            return services;
        }

        /// <summary>Repositorios y UnitOfWork del módulo (sin DbContext; útil para tests).</summary>
        public static IServiceCollection AddUsersRepositories(this IServiceCollection services)
        {
            services.AddModuleRepository<UsersDbContext, User>();
            services.AddModuleRepository<UsersDbContext, Musician>();
            services.AddScoped<IOpenMusicianSearchRepository, Repositories.OpenMusicianSearchRepository>();
            services.AddModuleUnitOfWork<IUnitOfWorkUser, UnitOfWorkUser, UsersDbContext>();
            return services;
        }
    }
}
