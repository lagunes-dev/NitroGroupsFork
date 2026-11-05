using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>Solicitud de evento tal como la ven el cliente o el grupo.</summary>
    public class EventRequestResponse
    {
        public long Id { get; set; }
        public long GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public string GroupSlug { get; set; } = string.Empty;

        /// <summary>Nombre del cliente abreviado por privacidad: nombre e inicial del apellido.</summary>
        public string ClientName { get; set; } = string.Empty;

        public DateOnly EventDate { get; set; }
        public TimeOnly? StartTime { get; set; }
        public int DurationHours { get; set; }
        public string EventType { get; set; } = string.Empty;
        public string LocationText { get; set; } = string.Empty;
        public int? GuestCount { get; set; }
        public decimal? Budget { get; set; }
        public string Currency { get; set; } = "MXN";
        public string Message { get; set; } = string.Empty;
        public EventRequestStatus Status { get; set; }
        /// <summary>La cargó el propio grupo (no cuenta en métricas públicas).</summary>
        public bool IsSelfBooked { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RespondedAt { get; set; }
        public string? ResponseMessage { get; set; }

        /// <summary>Anticipo registrado por el grupo. El cliente no ve el setlist ni los pagos a los músicos.</summary>
        public GigDepositResponse Deposit { get; set; } = new();

        /// <summary>Solo en el detalle (<c>GET api/event-requests/{id}</c>); null en los listados.</summary>
        public List<EventRequestMessageResponse>? Messages { get; set; }
    }

    public class EventRequestMessageResponse
    {
        public long Id { get; set; }
        public long SenderUserId { get; set; }
        public EventRequestParty SenderParty { get; set; }

        /// <summary>Nombre del grupo si escribe el grupo; nombre e inicial si escribe el cliente.</summary>
        public string SenderName { get; set; } = string.Empty;

        public string Body { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
