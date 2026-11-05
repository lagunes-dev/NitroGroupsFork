using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.Create;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Shared.Domain.DomainEvents.Users.Enums;
using NSubstitute;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>Reloj fijo para las reglas de "hoy en México".</summary>
internal sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => utcNow;
}

/// <summary>
/// Escenario común: el grupo 10 ("Los Vargas") lo administra el usuario 100; la clienta es la
/// usuaria 200 (Ana López); el usuario 300 no tiene nada que ver; los usuarios 400 (Mateo Ruiz) y
/// 500 (Sofía Nava) son miembros activos de Los Vargas. Hoy es 3/11/2026 al mediodía en México.
/// </summary>
internal sealed class BookingsTestScenario
{
    public const long GroupId = 10;
    public const long OtherGroupId = 20;
    public const long ManagerId = 100;
    public const long ClientId = 200;
    public const long OutsiderId = 300;
    public const long MemberId = 400;
    public const long OtherMemberId = 500;

    public static readonly DateTimeOffset Now = new(2026, 11, 3, 18, 0, 0, TimeSpan.Zero); // 12:00 en CDMX
    public static readonly DateOnly FutureDate = new(2026, 12, 12);

    public IGroupsModuleApi Groups { get; } = Substitute.For<IGroupsModuleApi>();
    public IUsersModuleApi Users { get; } = Substitute.For<IUsersModuleApi>();
    public ISchedulesModuleApi Schedules { get; } = Substitute.For<ISchedulesModuleApi>();
    public TimeProvider Time { get; set; } = new FixedTimeProvider(Now);

    public static readonly GroupSummary Vargas = new(GroupId, "los-vargas", "Los Vargas", "grupo@vargas.mx", ManagerId, true, null);
    public static readonly GroupSummary Otro = new(OtherGroupId, "otro", "Otro Grupo", "otro@grupo.mx", 999, true, null);

    public Dictionary<long, UserSummary> AllUsers { get; } = new()
    {
        [ManagerId] = new UserSummary(ManagerId, "manager@vargas.mx", "Pedro", "Vargas", UserType.Musician, null),
        [ClientId] = new UserSummary(ClientId, "ana@cliente.mx", "Ana", "López", UserType.Client, null),
        [OutsiderId] = new UserSummary(OutsiderId, "otro@cliente.mx", "Luis", "Pérez", UserType.Client, null),
        [MemberId] = new UserSummary(MemberId, "mateo@vargas.mx", "Mateo", "Ruiz", UserType.Musician, null),
        [OtherMemberId] = new UserSummary(OtherMemberId, "sofia@vargas.mx", "Sofía", "Nava", UserType.Musician, null),
    };

    /// <summary>
    /// Membresías activas por usuario: es lo único que Bookings sabe de Groups
    /// (<see cref="IGroupsModuleApi.GetUserGroupMembershipsAsync"/>). Una membresía dada de baja
    /// no aparece en esta lista.
    /// </summary>
    public Dictionary<long, List<GroupMembershipSummary>> Memberships { get; } = new()
    {
        [ManagerId] = [Membership(GroupId, GroupMemberRole.Manager)],
        [MemberId] = [Membership(GroupId, GroupMemberRole.Member)],
        [OtherMemberId] = [Membership(GroupId, GroupMemberRole.Member)],
    };

    public static GroupMembershipSummary Membership(long groupId, GroupMemberRole role) => new()
    {
        GroupId = groupId,
        GroupName = groupId == GroupId ? Vargas.GroupName : Otro.GroupName,
        Slug = groupId == GroupId ? Vargas.Slug : Otro.Slug,
        Role = role,
        JoinedAt = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc)
    };

    /// <summary>Cambia las membresías activas del usuario (sin argumentos = sin membresías).</summary>
    public void SetMemberships(long userId, params GroupMembershipSummary[] memberships)
        => Memberships[userId] = [.. memberships];

    public BookingsTestScenario()
    {
        var groups = new Dictionary<long, GroupSummary> { [GroupId] = Vargas, [OtherGroupId] = Otro };
        Groups.GetGroupAsync(Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(ci => groups.GetValueOrDefault(ci.ArgAt<long>(0)));
        Groups.GetGroupsAsync(Arg.Any<IEnumerable<long>>(), Arg.Any<CancellationToken>())
            .Returns(ci => (IReadOnlyDictionary<long, GroupSummary>)ci.ArgAt<IEnumerable<long>>(0)
                .Distinct().Where(groups.ContainsKey).ToDictionary(id => id, id => groups[id]));
        Groups.CanManageGroupAsync(GroupId, ManagerId, Arg.Any<CancellationToken>()).Returns(true);
        Groups.GetManagerUserIdsAsync(GroupId, Arg.Any<CancellationToken>()).Returns([ManagerId]);
        Groups.GetUserGroupMembershipsAsync(Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(ci => Memberships.TryGetValue(ci.ArgAt<long>(0), out var memberships)
                ? (IReadOnlyList<GroupMembershipSummary>)memberships
                : []);

        Users.GetUserAsync(Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(ci => AllUsers.GetValueOrDefault(ci.ArgAt<long>(0)));
        Users.GetUsersAsync(Arg.Any<IEnumerable<long>>(), Arg.Any<CancellationToken>())
            .Returns(ci => (IReadOnlyDictionary<long, UserSummary>)ci.ArgAt<IEnumerable<long>>(0)
                .Distinct().Where(AllUsers.ContainsKey).ToDictionary(id => id, id => AllUsers[id]));

        Schedules.GetUnavailableGroupIdsAsync(Arg.Any<IReadOnlyCollection<long>>(), Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new HashSet<long>());
    }

    public static CreateEventRequestCommand CreateCommand(DateOnly? date = null, long groupId = GroupId) => new(
        ClientUserId: ClientId,
        GroupId: groupId,
        EventDate: date ?? FutureDate,
        StartTime: new TimeOnly(20, 0),
        DurationHours: 5,
        EventType: "Boda",
        LocationText: "Salón Los Arcos, CDMX",
        GuestCount: 150,
        Budget: 25000m,
        Message: "Buscamos mariachi para la entrada y el vals.");

    /// <summary>Guarda una solicitud directamente (sin pasar por el handler de creación).</summary>
    public static async Task<EventRequest> SeedAsync(
        BookingsDbContext context,
        long groupId = GroupId,
        long clientId = ClientId,
        Action<EventRequest>? configure = null,
        DateTime? createdAt = null,
        DateOnly? eventDate = null,
        TimeOnly? startTime = null)
    {
        var request = new EventRequest
        {
            GroupId = groupId,
            ClientUserId = clientId,
            EventDate = eventDate ?? FutureDate,
            StartTime = startTime,
            DurationHours = 4,
            EventType = "XV años",
            LocationText = "Jardín Las Flores",
            Message = "Queremos serenata a las 22 h.",
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
        configure?.Invoke(request);
        request.ClearDomainEvents();
        context.EventRequests.Add(request);
        await context.SaveChangesAsync();
        return request;
    }

    /// <summary>Guarda un toque ya aceptado del grupo (lo que ve la agenda).</summary>
    public static Task<EventRequest> SeedGigAsync(
        BookingsDbContext context,
        long groupId = GroupId,
        DateOnly? eventDate = null,
        TimeOnly? startTime = null)
        => SeedAsync(
            context,
            groupId: groupId,
            eventDate: eventDate ?? FutureDate,
            startTime: startTime ?? new TimeOnly(20, 0),
            configure: request => request.Accept(null, DateTime.UtcNow));
}
