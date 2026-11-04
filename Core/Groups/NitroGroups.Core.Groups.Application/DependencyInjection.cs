using Cortex.Mediator.DependencyInjection;
using Cortex.Mediator.Notifications;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NitroGroups.Core.Groups.Application.EventHandlers;
using NitroGroups.Core.Groups.Application.Events;

namespace NitroGroups.Core.Groups.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddGroupsApplication(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddAutoMapper(cfg =>
            {
                cfg.AddMaps(typeof(DependencyInjection).Assembly);
            });

            services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

            services.AddCortexMediator([typeof(DependencyInjection)]);

            // Avisos por email de membresías (T4): el outbox los resuelve por el nombre del evento.
            services.AddScoped<GroupMembershipEmailRecipients>();
            services.AddScoped<INotificationHandler<GroupMembershipEvents.GroupMembershipInvitationCreatedEvent>, GroupMembershipInvitationCreatedEmailHandler>();
            services.AddScoped<INotificationHandler<GroupMembershipEvents.GroupMembershipJoinRequestCreatedEvent>, GroupMembershipJoinRequestCreatedEmailHandler>();
            services.AddScoped<INotificationHandler<GroupMembershipEvents.GroupMembershipInvitationResolvedEvent>, GroupMembershipInvitationResolvedEmailHandler>();
            services.AddScoped<INotificationHandler<GroupMembershipEvents.GroupMembershipJoinRequestResolvedEvent>, GroupMembershipJoinRequestResolvedEmailHandler>();

            return services;
        }
    }
}
