using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs;

/// <summary>
/// Arma las filas del panel del manager: la misma fila del miembro más las respuestas de todos
/// los miembros, con su nombre (nunca su email).
/// </summary>
public static class GroupGigResponses
{
    public static List<GroupGigResponse> Build(
        IReadOnlyCollection<EventRequest> gigs,
        string groupName,
        string groupSlug,
        GroupMemberRole? callerRole,
        long? callerUserId,
        IReadOnlyDictionary<long, List<GigAttendance>> attendanceByGig,
        IReadOnlyDictionary<long, UserSummary> users)
        => gigs.Select(gig =>
        {
            var rows = attendanceByGig.GetValueOrDefault(gig.Id) ?? [];
            var attendees = rows
                .Select(row => Attendee(row, users))
                .OrderBy(attendee => attendee.Status == nameof(GigAttendanceStatus.Confirmed) ? 0 : 1)
                .ThenBy(attendee => attendee.FullName, StringComparer.Ordinal)
                .ToList();
            var mine = rows.FirstOrDefault(row => row.UserId == callerUserId);

            var row = new GroupGigResponse { Attendees = attendees };
            GigResponses.Fill(row, gig, groupName, groupSlug, callerRole, mine?.Status);
            return row;
        }).ToList();

    /// <summary>Una respuesta de asistencia con el nombre del miembro; el email nunca sale de Users.</summary>
    public static GigAttendeeResponse Attendee(GigAttendance attendance, IReadOnlyDictionary<long, UserSummary> users)
        => new()
        {
            UserId = attendance.UserId,
            FullName = users.GetValueOrDefault(attendance.UserId)?.FullName ?? string.Empty,
            Status = attendance.Status.ToString()
        };
}
