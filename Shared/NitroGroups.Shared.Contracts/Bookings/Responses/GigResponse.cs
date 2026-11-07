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

        /// <summary>
        /// Teléfono de contacto del grupo, para escribirle al manager (S22). Null cuando el grupo no
        /// lo cargó. Solo existe en esta vista: la fila del manager, la del cliente y el perfil
        /// público nunca lo llevan.
        /// </summary>
        public string? ManagerPhone { get; set; }

        /// <summary>
        /// Quiénes tocan este toque (S22): los miembros que confirmaron, el llamante incluido si
        /// confirmó. Ni quien rechazó ni quien todavía no respondió. Vacía cuando nadie confirmó.
        /// </summary>
        public List<GigTeammateResponse> Teammates { get; set; } = [];
    }

    /// <summary>
    /// Un compañero confirmado en un toque, con su nombre y sus instrumentos. Los dos datos salen
    /// del módulo Users y nunca incluyen un correo.
    /// </summary>
    public class GigTeammateResponse
    {
        public long UserId { get; set; }

        /// <summary>Nombre completo, o vacío si Users no lo tiene; el correo no es un respaldo.</summary>
        public string FullName { get; set; } = string.Empty;

        /// <summary>
        /// Rol en el grupo, como texto: "Owner", "Manager" o "Member". Null cuando el módulo Groups
        /// no lo tiene (una respuesta de alguien que ya no es miembro activo): la fila muestra el
        /// nombre solo.
        /// </summary>
        public string? Role { get; set; }
    }
}
