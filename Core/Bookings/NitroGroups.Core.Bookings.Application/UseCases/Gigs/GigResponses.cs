using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs;

/// <summary>
/// Reglas compartidas por la agenda del miembro (<c>GET api/me/gigs</c>) y el panel del manager
/// (<c>GET api/groups/{groupId}/gigs</c>): qué ventana de fechas se muestra.
/// </summary>
public static class GigAgenda
{
    /// <summary>Un toque sigue en la agenda 30 días después de su fecha.</summary>
    public const int PastDays = 30;

    /// <summary>Primer día visible en la agenda, contando "hoy" en hora de México.</summary>
    public static DateOnly FirstVisibleDate(TimeProvider time) => MexicoTime.Today(time).AddDays(-PastDays);
}

/// <summary>
/// Arma las filas de la agenda. El nombre del grupo y el rol del llamante salen de su membresía
/// (nunca del esquema de Groups); la asistencia es solo la del llamante.
/// </summary>
public static class GigResponses
{
    public static List<GigResponse> Build(
        IReadOnlyCollection<EventRequest> gigs,
        IReadOnlyDictionary<long, GroupMembershipSummary> memberships,
        IReadOnlyDictionary<long, GigAttendanceStatus> attendance)
        => gigs.Select(gig =>
        {
            var membership = memberships.GetValueOrDefault(gig.GroupId);
            return Build(
                gig,
                membership?.GroupName ?? string.Empty,
                membership?.Slug ?? string.Empty,
                membership?.Role,
                attendance.TryGetValue(gig.Id, out var status) ? status : null);
        }).ToList();

    public static GigResponse Build(
        EventRequest gig,
        string groupName,
        string groupSlug,
        GroupMemberRole? role,
        GigAttendanceStatus? attendance)
    {
        var row = new GigResponse();
        Fill(row, gig, groupName, groupSlug, role, attendance);
        return row;
    }

    /// <summary>Copia los datos del toque en una fila de la agenda (la base que comparten las dos vistas).</summary>
    internal static void Fill(
        GigResponse row,
        EventRequest gig,
        string groupName,
        string groupSlug,
        GroupMemberRole? role,
        GigAttendanceStatus? attendance)
    {
        row.Id = gig.Id;
        row.GroupId = gig.GroupId;
        row.GroupName = groupName;
        row.GroupSlug = groupSlug;
        row.EventDate = gig.EventDate;
        row.StartTime = gig.StartTime;
        row.DurationHours = gig.DurationHours;
        row.EventType = gig.EventType;
        row.LocationText = gig.LocationText;
        row.Role = role?.ToString() ?? string.Empty;
        row.Attendance = attendance?.ToString();
    }
}
