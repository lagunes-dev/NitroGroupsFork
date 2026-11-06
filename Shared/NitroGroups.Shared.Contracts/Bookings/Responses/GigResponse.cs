namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// Lo que comparten las dos vistas de un toque (solicitud de evento aceptada): la agenda del
    /// miembro y el panel del manager.
    /// </summary>
    public class GigBaseResponse
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

        /// <summary>Hora de llamado ("HH:mm:ss") o null.</summary>
        public TimeOnly? CallTime { get; set; }

        /// <summary>Lista de canciones en texto libre, o null.</summary>
        public string? Setlist { get; set; }
    }

    /// <summary>
    /// Un toque tal como lo ve un miembro del grupo en su agenda (<c>GET api/me/gigs</c>).
    /// </summary>
    public class GigResponse : GigBaseResponse
    {
        /// <summary>Lo que se le paga al llamante por este toque; nunca el pago de otra persona.</summary>
        public decimal? MyPay { get; set; }

        /// <summary>Cuándo el manager registró que le pagaron; null mientras no.</summary>
        public DateTime? MyPayPaidAt { get; set; }
    }
}
