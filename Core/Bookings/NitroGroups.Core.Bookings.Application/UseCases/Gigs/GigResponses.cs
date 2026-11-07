using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Contracts.Users.Responses;
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
        IReadOnlyDictionary<long, GigAttendanceStatus?> attendance,
        IReadOnlyDictionary<long, (decimal Amount, DateTime? PaidAt)> myPay,
        IReadOnlyDictionary<long, GroupSummary> groups,
        IReadOnlyDictionary<long, List<GigTeammateResponse>> teammates)
        => gigs.Select(gig =>
        {
            var membership = memberships.GetValueOrDefault(gig.GroupId);
            var row = Build(
                gig,
                membership?.GroupName ?? string.Empty,
                membership?.Slug ?? string.Empty,
                membership?.Role,
                attendance.GetValueOrDefault(gig.Id),
                myPay.TryGetValue(gig.Id, out var mine) ? mine.Amount : null,
                myPay.TryGetValue(gig.Id, out var paid) ? paid.PaidAt : null);
            row.ManagerPhone = ManagerPhone(groups.GetValueOrDefault(gig.GroupId)?.Phone);
            row.Teammates = teammates.GetValueOrDefault(gig.Id) ?? [];
            return row;
        }).ToList();

    public static GigResponse Build(
        EventRequest gig,
        string groupName,
        string groupSlug,
        GroupMemberRole? role,
        GigAttendanceStatus? attendance,
        decimal? myPay = null,
        DateTime? myPayPaidAt = null)
    {
        var row = new GigResponse { MyPay = myPay, MyPayPaidAt = myPayPaidAt };
        Fill(row, gig, groupName, groupSlug, role, attendance);
        return row;
    }

    /// <summary>
    /// S22: quiénes tocan el toque. Solo las respuestas confirmadas —quien rechazó no va y quien no
    /// respondió todavía no está—, más el llamante cuando su propia respuesta es "Confirmado" (una
    /// sola vez, aunque su fila de asistencia ya esté en la lista). El nombre sale del módulo Users y
    /// el rol del módulo Groups: nunca se lee el esquema de ninguno de los dos y el correo nunca es
    /// un respaldo.
    /// </summary>
    public static List<GigTeammateResponse> Teammates(
        IEnumerable<GigAttendance> attendance,
        long callerUserId,
        GigAttendanceStatus? callerStatus,
        IReadOnlyDictionary<long, UserSummary> users,
        IReadOnlyDictionary<long, OpenMusicianSummary> musicians,
        IReadOnlyDictionary<long, string> roles)
    {
        var confirmed = attendance
            .Where(row => row.Status == GigAttendanceStatus.Confirmed)
            .Select(row => row.UserId)
            .Distinct()
            .ToList();

        if (callerStatus == GigAttendanceStatus.Confirmed && !confirmed.Contains(callerUserId))
            confirmed.Add(callerUserId);

        return confirmed
            .Select(userId => Teammate(userId, users, musicians, roles))
            .OrderBy(teammate => teammate.FullName, StringComparer.Ordinal)
            .ThenBy(teammate => teammate.UserId)
            .ToList();
    }

    private static GigTeammateResponse Teammate(
        long userId,
        IReadOnlyDictionary<long, UserSummary> users,
        IReadOnlyDictionary<long, OpenMusicianSummary> musicians,
        IReadOnlyDictionary<long, string> roles)
        => new()
        {
            UserId = userId,
            FullName = Text(users.GetValueOrDefault(userId)?.FullName)
                ?? Text(musicians.GetValueOrDefault(userId)?.FullName)
                ?? string.Empty,
            Role = Text(roles.GetValueOrDefault(userId))
        };

    /// <summary>El teléfono del grupo, o null cuando no hay dato: la fila nunca manda "".</summary>
    private static string? ManagerPhone(string? phone) => string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();

    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>Copia los datos del toque en una fila de la agenda (la base que comparten las dos vistas).</summary>
    internal static void Fill(
        GigBaseResponse row,
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
        row.CallTime = gig.CallTime;
        row.Setlist = gig.Setlist;
    }
}
