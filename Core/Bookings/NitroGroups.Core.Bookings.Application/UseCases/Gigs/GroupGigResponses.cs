using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs;

/// <summary>
/// Arma las filas del panel del manager: la misma fila del miembro más las respuestas de todos
/// los miembros, con su nombre (nunca su email).
/// </summary>
public static class GroupGigResponses
{
    /// <summary>
    /// Carga lo que falta de Groups, Users y de las tablas de asistencia y pago, y arma las filas
    /// del panel. El rol es el del llamante en el grupo (vacío si es admin sin membresía).
    /// </summary>
    public static async Task<List<GroupGigResponse>> LoadAsync(
        IUnitOfWorkBookings unitOfWork,
        IGroupsModuleApi groups,
        IUsersModuleApi users,
        long groupId,
        long? callerUserId,
        IReadOnlyCollection<EventRequest> gigs,
        CancellationToken cancellationToken)
    {
        var group = await groups.GetGroupAsync(groupId, cancellationToken);

        IReadOnlyList<GroupMembershipSummary> memberships = callerUserId is null
            ? []
            : await groups.GetUserGroupMembershipsAsync(callerUserId.Value, cancellationToken);
        var membership = memberships.FirstOrDefault(candidate => candidate.GroupId == groupId);

        var gigIds = gigs.Select(gig => gig.Id).ToList();
        var attendance = await unitOfWork.GigAttendances.ListByEventRequestsAsync(gigIds, cancellationToken);
        var byGig = attendance
            .GroupBy(row => row.EventRequestId)
            .ToDictionary(rows => rows.Key, rows => rows.ToList());
        var pay = (await unitOfWork.GigPays.ListByEventRequestsAsync(gigIds, cancellationToken))
            .ToDictionary(row => (row.EventRequestId, row.UserId), row => (row.Amount, row.PaidAt));
        var userMap = await users.GetUsersAsync(
            attendance.Select(row => row.UserId).Distinct(), cancellationToken);

        return Build(
            gigs,
            group?.GroupName ?? membership?.GroupName ?? string.Empty,
            group?.Slug ?? membership?.Slug ?? string.Empty,
            membership?.Role,
            callerUserId,
            byGig,
            userMap,
            pay);
    }

    public static List<GroupGigResponse> Build(
        IReadOnlyCollection<EventRequest> gigs,
        string groupName,
        string groupSlug,
        GroupMemberRole? callerRole,
        long? callerUserId,
        IReadOnlyDictionary<long, List<GigAttendance>> attendanceByGig,
        IReadOnlyDictionary<long, UserSummary> users,
        IReadOnlyDictionary<(long EventRequestId, long UserId), (decimal Amount, DateTime? PaidAt)> pay)
        => gigs.Select(gig =>
        {
            var rows = attendanceByGig.GetValueOrDefault(gig.Id) ?? [];
            var attendees = rows
                .Select(row => Attendee(row, users, pay.TryGetValue((gig.Id, row.UserId), out var mine) ? mine : null))
                .OrderBy(attendee => attendee.Status == nameof(GigAttendanceStatus.Confirmed) ? 0 : 1)
                .ThenBy(attendee => attendee.FullName, StringComparer.Ordinal)
                .ToList();
            var mine = rows.FirstOrDefault(row => row.UserId == callerUserId);

            var row = new GroupGigResponse
            {
                Attendees = attendees,
                Deposit = new GigDepositResponse { Amount = gig.DepositAmount, ReceivedAt = gig.DepositReceivedAt },
                BalanceReceivedAt = gig.BalanceReceivedAt,
                // T60 (S23): el cachet del pedido, tal como lo dejó el cliente. Un dato, no un cálculo.
                Budget = gig.Budget,
                Currency = gig.Currency
            };
            GigResponses.Fill(row, gig, groupName, groupSlug, callerRole, mine?.Status);
            return row;
        }).ToList();

    /// <summary>Una respuesta de asistencia con el nombre del miembro; el email nunca sale de Users.</summary>
    public static GigAttendeeResponse Attendee(GigAttendance attendance, IReadOnlyDictionary<long, UserSummary> users, (decimal Amount, DateTime? PaidAt)? pay = null)
        => new()
        {
            UserId = attendance.UserId,
            FullName = users.GetValueOrDefault(attendance.UserId)?.FullName ?? string.Empty,
            Status = attendance.Status.ToString(),
            Pay = pay?.Amount,
            PaidAt = pay?.PaidAt
        };
}
