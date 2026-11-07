namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// Un toque (solicitud de evento aceptada) tal como lo ve un miembro del grupo en su agenda
    /// (<c>GET api/me/gigs</c>).
    /// </summary>
    public class GigResponse
    {
        public long Id { get; set; }
        public long GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public string GroupSlug { get; set; } = string.Empty;
        public DateOnly EventDate { get; set; }
        public TimeOnly? StartTime { get; set; }
        public int DurationHours { get; set; }
        public string EventType { get; set; } = string.Empty;
        public string LocationText { get; set; } = string.Empty;

        /// <summary>Rol del llamante en el grupo: Owner, Manager o Member.</summary>
        public string Role { get; set; } = string.Empty;

        /// <summary>Confirmed, Declined, o null mientras el llamante no responde.</summary>
        public string? Attendance { get; set; }
    }
}
