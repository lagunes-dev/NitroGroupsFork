using Cortex.Mediator.Notifications;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.EventHandlers;
using NitroGroups.Core.Groups.Application.Events;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.EndpointMapping;
using NitroGroups.Shared.Infrastructure.Persistence;

namespace NitroGroups.Core.Groups.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddGroupsInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddModuleDbContext<GroupsDbContext>(configuration, GroupsDbContext.SchemaName);
            services.AddGroupsRepositories();

            services.AddScoped<IGroupsModuleApi, GroupsModuleApi>();

            services.AddScoped<INotificationHandler<UsersEvents.SoloMusicianCreatedEvent>, SoloMusicianCreatedEventHandler>();
            services.AddScoped<INotificationHandler<UsersEvents.MusicianWithGroupCreatedEvent>, MusicianWithGroupCreatedEventHandler>();
            services.AddScoped<INotificationHandler<BookingsEvents.GroupReviewPostedEvent>, GroupReviewPostedEventHandler>();

            services.AddEndpoints(typeof(DependencyInjection).Assembly);

            return services;
        }

        /// <summary>Repositorios y UnitOfWork del módulo (sin DbContext; útil para tests).</summary>
        public static IServiceCollection AddGroupsRepositories(this IServiceCollection services)
        {
            services.AddModuleRepository<GroupsDbContext, Group>();
            services.AddModuleRepository<GroupsDbContext, GroupMember>();
            services.AddModuleRepository<GroupsDbContext, MusicGenre>();
            services.AddModuleRepository<GroupsDbContext, GroupGenre>();
            services.AddModuleRepository<GroupsDbContext, GroupMedia>();
            services.AddScoped<IGroupSearchRepository, Repositories.GroupSearchRepository>();
            services.AddScoped<IGroupMembershipRequestRepository, Repositories.GroupMembershipRequestRepository>();
            services.AddModuleUnitOfWork<IUnitOfWorkGroups, UnitOfWorkGroups, GroupsDbContext>();
            return services;
        }
    }
}
