using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Core.Groups.Application.Events;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Invite;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.RequestToJoin;
using NitroGroups.Core.Groups.Application.UseCases.MembershipRequests.Respond;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Abstractions.Services;
using NitroGroups.Shared.Infrastructure.Context.Entities;
using NitroGroups.Shared.Infrastructure.Events;
using NitroGroups.Shared.Infrastructure.Services;
using NitroGroups.Shared.Domain.DomainEvents.Groups;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;
using NSubstitute;

namespace NitroGroups.Tests.Integration.Groups;

/// <summary>
/// T4 (S5): los cuatro avisos de membresía salen por el outbox de Groups, igual que en Bookings.
/// El caso de uso guarda el evento en <c>outbox_events</c>; el outbox lo deserializa al tipo
/// INotification del módulo (lo busca por el nombre de la clase base) y su handler manda el email.
/// </summary>
public class GroupMembershipNoticesIntegrationTests : IClassFixture<IntegrationTestFixture>
{
    private static readonly CancellationToken AnyToken = CancellationToken.None;

    private readonly IntegrationTestFixture _fixture;

    public GroupMembershipNoticesIntegrationTests(IntegrationTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Invitar_DejaUnSoloAvisoEnElOutbox_ParaElMusicoInvitado()
    {
        await using var app = await NoticeApp.CreateAsync(_fixture);
        var musicianId = await app.Harness.AddMusicianAsync("Ana", "López");
        var musicianEmail = await app.EmailOfAsync(musicianId);
        var groupId = await app.Harness.AddGroupAsync();

        var invited = await app.Harness.Invite(new InviteMusicianCommand(
            groupId, GroupMembershipTestHarness.OwnerId, musicianId, "Únete al grupo"));

        Assert.True(invited.IsSuccess, invited.Error);

        var queued = Assert.Single(app.OutboxRows());
        Assert.Equal(nameof(GroupMembershipInvitationCreatedEvent), queued.EventType);
        Assert.False(queued.Processed);

        await app.DispatchAsync();

        await app.Email.Received(1).SendAsync(
            musicianEmail,
            "Los Test te invitó a unirte",
            Arg.Is<string>(body => !body.Contains('@')),
            Arg.Any<CancellationToken>());
        await app.Email.Received(1).SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        Assert.True(Assert.Single(app.OutboxRows()).Processed);
    }

    [Fact]
    public async Task PedirUnirse_DejaUnAviso_YLoMandaAlOwnerYALosManagers()
    {
        await using var app = await NoticeApp.CreateAsync(_fixture);
        var ownerId = await app.Harness.AddMusicianAsync("Pedro", "Vargas");
        var managerId = await app.Harness.AddMusicianAsync("Rosa", "Vargas");
        var musicianId = await app.Harness.AddMusicianAsync("Ana", "López");
        var groupId = await app.Harness.AddGroupAsync(ownerId: ownerId);
        await app.Harness.AddMemberAsync(groupId, managerId, GroupMemberRole.Manager);

        var ownerEmail = await app.EmailOfAsync(ownerId);
        var managerEmail = await app.EmailOfAsync(managerId);

        var requested = await app.Harness.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, "Quiero entrar"));

        Assert.True(requested.IsSuccess, requested.Error);

        var queued = Assert.Single(app.OutboxRows());
        Assert.Equal(nameof(GroupMembershipJoinRequestCreatedEvent), queued.EventType);

        await app.DispatchAsync();

        const string subject = "Nueva solicitud para unirse a Los Test";
        await app.Email.Received(1).SendAsync(ownerEmail, subject, Arg.Is<string>(body => !body.Contains('@')), Arg.Any<CancellationToken>());
        await app.Email.Received(1).SendAsync(managerEmail, subject, Arg.Is<string>(body => !body.Contains('@')), Arg.Any<CancellationToken>());
        // Dos managers, dos emails: el músico que pidió unirse no recibe nada.
        await app.Email.Received(2).SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AceptarUnaSolicitud_AvisaSoloAlMusicoQueLaHizo()
    {
        await using var app = await NoticeApp.CreateAsync(_fixture);
        var ownerId = await app.Harness.AddMusicianAsync("Pedro", "Vargas");
        var musicianId = await app.Harness.AddMusicianAsync("Ana", "López");
        var groupId = await app.Harness.AddGroupAsync(ownerId: ownerId);
        var musicianEmail = await app.EmailOfAsync(musicianId);

        var requested = await app.Harness.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));
        Assert.True(requested.IsSuccess, requested.Error);
        await app.DispatchAsync();
        app.Email.ClearReceivedCalls();

        var accepted = await app.Harness.Respond(new RespondToMembershipRequestCommand(
            requested.Value!.Id, ownerId, MembershipRequestDecision.Accept));

        Assert.True(accepted.IsSuccess, accepted.Error);
        var queued = Assert.Single(app.OutboxRows(), row => !row.Processed);
        Assert.Equal(nameof(GroupMembershipJoinRequestResolvedEvent), queued.EventType);

        await app.DispatchAsync();

        await app.Email.Received(1).SendAsync(
            musicianEmail,
            "Los Test aceptó tu solicitud para unirte",
            Arg.Is<string>(body => !body.Contains('@')),
            Arg.Any<CancellationToken>());
        await app.Email.Received(1).SendAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RechazarUnaInvitacion_AvisaAlManagerQueInvito()
    {
        await using var app = await NoticeApp.CreateAsync(_fixture);
        var ownerId = await app.Harness.AddMusicianAsync("Pedro", "Vargas");
        var musicianId = await app.Harness.AddMusicianAsync("Ana", "López");
        var groupId = await app.Harness.AddGroupAsync(ownerId: ownerId);
        var ownerEmail = await app.EmailOfAsync(ownerId);
        var musicianEmail = await app.EmailOfAsync(musicianId);

        var invited = await app.Harness.Invite(new InviteMusicianCommand(groupId, ownerId, musicianId, null));
        Assert.True(invited.IsSuccess, invited.Error);
        await app.DispatchAsync();
        app.Email.ClearReceivedCalls();

        var declined = await app.Harness.Respond(new RespondToMembershipRequestCommand(
            invited.Value!.Id, musicianId, MembershipRequestDecision.Decline));

        Assert.True(declined.IsSuccess, declined.Error);
        var queued = Assert.Single(app.OutboxRows(), row => !row.Processed);
        Assert.Equal(nameof(GroupMembershipInvitationResolvedEvent), queued.EventType);

        await app.DispatchAsync();

        const string subject = "Ana López rechazó tu invitación a Los Test";
        await app.Email.Received(1).SendAsync(ownerEmail, subject, Arg.Is<string>(body => !body.Contains('@')), Arg.Any<CancellationToken>());
        // Quien resolvió (el músico) no recibe aviso de su propia decisión.
        await app.Email.DidNotReceive().SendAsync(musicianEmail, Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Responder_NoAvisaAQuienResolvio()
    {
        await using var app = await NoticeApp.CreateAsync(_fixture);
        var ownerId = await app.Harness.AddMusicianAsync("Pedro", "Vargas");
        var managerId = await app.Harness.AddMusicianAsync("Rosa", "Vargas");
        var musicianId = await app.Harness.AddMusicianAsync("Ana", "López");
        var groupId = await app.Harness.AddGroupAsync(ownerId: ownerId);
        await app.Harness.AddMemberAsync(groupId, managerId, GroupMemberRole.Manager);

        var managerEmail = await app.EmailOfAsync(managerId);
        var ownerEmail = await app.EmailOfAsync(ownerId);
        var musicianEmail = await app.EmailOfAsync(musicianId);

        var requested = await app.Harness.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));
        Assert.True(requested.IsSuccess, requested.Error);
        await app.DispatchAsync(); // el aviso de la solicitud sí va a los managers
        app.Email.ClearReceivedCalls();

        var declined = await app.Harness.Respond(new RespondToMembershipRequestCommand(
            requested.Value!.Id, managerId, MembershipRequestDecision.Decline));
        Assert.True(declined.IsSuccess, declined.Error);

        await app.DispatchAsync();

        // El manager que rechazó y el resto del grupo no reciben el aviso: va solo al músico.
        await app.Email.Received(1).SendAsync(
            musicianEmail,
            "Los Test rechazó tu solicitud para unirte",
            Arg.Is<string>(body => !body.Contains('@')),
            Arg.Any<CancellationToken>());
        await app.Email.DidNotReceive().SendAsync(managerEmail, Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await app.Email.DidNotReceive().SendAsync(ownerEmail, Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CancelarUnaInvitacion_AvisaAlMusico_YNuncaAlManagerQueLaRetiro()
    {
        await using var app = await NoticeApp.CreateAsync(_fixture);
        var ownerId = await app.Harness.AddMusicianAsync("Pedro", "Vargas");
        var managerId = await app.Harness.AddMusicianAsync("Rosa", "Vargas");
        var musicianId = await app.Harness.AddMusicianAsync("Ana", "López");
        var groupId = await app.Harness.AddGroupAsync(ownerId: ownerId);
        await app.Harness.AddMemberAsync(groupId, managerId, GroupMemberRole.Manager);

        var musicianEmail = await app.EmailOfAsync(musicianId);
        var managerEmail = await app.EmailOfAsync(managerId);

        var invited = await app.Harness.Invite(new InviteMusicianCommand(groupId, managerId, musicianId, null));
        await app.DispatchAsync();
        app.Email.ClearReceivedCalls();

        var cancelled = await app.Harness.Respond(new RespondToMembershipRequestCommand(
            invited.Value!.Id, managerId, MembershipRequestDecision.Cancel));

        Assert.True(cancelled.IsSuccess, cancelled.Error);
        Assert.Equal(
            nameof(GroupMembershipInvitationResolvedEvent),
            Assert.Single(app.OutboxRows(), row => !row.Processed).EventType);

        await app.DispatchAsync();

        await app.Email.Received(1).SendAsync(
            musicianEmail,
            "Los Test canceló su invitación para unirte",
            Arg.Is<string>(body => !body.Contains('@')),
            Arg.Any<CancellationToken>());
        await app.Email.DidNotReceive().SendAsync(managerEmail, Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CancelarUnaSolicitud_AvisaALosManagersDelGrupo()
    {
        await using var app = await NoticeApp.CreateAsync(_fixture);
        var ownerId = await app.Harness.AddMusicianAsync("Pedro", "Vargas");
        var musicianId = await app.Harness.AddMusicianAsync("Ana", "López");
        var groupId = await app.Harness.AddGroupAsync(ownerId: ownerId);
        var ownerEmail = await app.EmailOfAsync(ownerId);
        var musicianEmail = await app.EmailOfAsync(musicianId);

        var requested = await app.Harness.RequestToJoin(new RequestToJoinGroupCommand(groupId, musicianId, null));
        await app.DispatchAsync();
        app.Email.ClearReceivedCalls();

        var cancelled = await app.Harness.Respond(new RespondToMembershipRequestCommand(
            requested.Value!.Id, musicianId, MembershipRequestDecision.Cancel));

        Assert.True(cancelled.IsSuccess, cancelled.Error);
        Assert.Equal(
            nameof(GroupMembershipJoinRequestResolvedEvent),
            Assert.Single(app.OutboxRows(), row => !row.Processed).EventType);

        await app.DispatchAsync();

        await app.Email.Received(1).SendAsync(
            ownerEmail,
            "Ana López canceló su solicitud para unirse a Los Test",
            Arg.Is<string>(body => !body.Contains('@')),
            Arg.Any<CancellationToken>());
        await app.Email.DidNotReceive().SendAsync(musicianEmail, Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SinSmtp_ElEnvioSoloQuedaEnElLog_ConDestinatarioYAsunto()
    {
        var logger = new CapturingLogger<LoggingEmailSender>();
        var sender = new LoggingEmailSender(logger);

        await sender.SendAsync("ana@ejemplo.mx", "Los Test te invitó a unirte", "cuerpo con datos", AnyToken);

        var line = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Information, line.Level);
        Assert.Contains("ana@ejemplo.mx", line.Message);
        Assert.Contains("Los Test te invitó a unirte", line.Message);
        Assert.DoesNotContain("cuerpo con datos", line.Message); // el cuerpo puede traer datos personales
    }

    /// <summary>
    /// El arnés de membresía con el outbox real de Groups sobre el mismo contexto, el proveedor de
    /// eventos del módulo y un <see cref="IEmailSender"/> de prueba.
    /// </summary>
    private sealed class NoticeApp : IAsyncDisposable
    {
        private readonly ServiceProvider _provider;
        private readonly OutboxService<GroupsDbContext> _outbox;

        private NoticeApp(
            ServiceProvider provider,
            GroupMembershipTestHarness harness,
            IEmailSender email,
            OutboxService<GroupsDbContext> outbox)
        {
            _provider = provider;
            _outbox = outbox;
            Harness = harness;
            Email = email;
        }

        internal GroupMembershipTestHarness Harness { get; }
        internal IEmailSender Email { get; }

        internal static async Task<NoticeApp> CreateAsync(IntegrationTestFixture fixture)
        {
            var harness = GroupMembershipTestHarness.Create(fixture);
            var email = Substitute.For<IEmailSender>();

            var services = new ServiceCollection();
            services.AddLogging();
            services.AddGroupsApplication(new ConfigurationBuilder().Build());
            services.AddSingleton(harness.GroupsApi);
            services.AddSingleton(harness.Users);
            services.AddSingleton(email);

            var provider = services.BuildServiceProvider();

            var eventProvider = new EventProvider();
            eventProvider.RegisterEventsFromAssembly(typeof(GroupMembershipEvents).Assembly);

            var outbox = new OutboxService<GroupsDbContext>(
                harness.GroupsContext,
                NullLogger<OutboxService<GroupsDbContext>>.Instance,
                provider,
                eventProvider);

            harness.UseOutbox(outbox);

            await Task.CompletedTask;
            return new NoticeApp(provider, harness, email, outbox);
        }

        internal List<OutboxEvent> OutboxRows() => Harness.GroupsContext.OutboxEvents.ToList();

        internal Task DispatchAsync() => _outbox.ProcessPendingEventsAsync();

        internal async Task<string> EmailOfAsync(long userId)
            => (await Harness.Users.GetUserAsync(userId, AnyToken))!.Email;

        public async ValueTask DisposeAsync()
        {
            await _provider.DisposeAsync();
            await Harness.DisposeAsync();
        }
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        internal List<(LogLevel Level, string Message)> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception)));
    }
}
