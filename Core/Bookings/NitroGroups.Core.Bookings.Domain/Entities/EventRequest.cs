using NitroGroups.Shared.Domain;
using NitroGroups.Shared.Domain.DomainEvents.Bookings;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Solicitud de evento que un cliente envía a un grupo (S10).
/// Transiciones válidas:
/// Pending → Accepted | Declined (grupo), Pending → Cancelled (cliente),
/// Accepted → Cancelled (cliente o grupo). Cualquier otra es un error.
/// </summary>
public class EventRequest : AuditableModel
{
    public long GroupId { get; set; }
    public long ClientUserId { get; set; }

    /// <summary>
    /// La pidió alguien que administra el grupo (un evento acordado fuera de la plataforma).
    /// Se permite, pero no debe contar en las métricas públicas del grupo.
    /// </summary>
    public bool IsSelfBooked { get; set; }
    public DateOnly EventDate { get; set; }
    public TimeOnly? StartTime { get; set; }
    public int DurationHours { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string LocationText { get; set; } = string.Empty;
    public int? GuestCount { get; set; }
    public decimal? Budget { get; set; }
    public string Currency { get; set; } = "MXN";
    public string Message { get; set; } = string.Empty;
    public EventRequestStatus Status { get; private set; } = EventRequestStatus.Pending;

    /// <summary>
    /// Versión para concurrencia optimista (columna de sistema xmin de PostgreSQL): si dos
    /// personas responden a la vez, solo el primer guardado gana y el otro recibe 409.
    /// </summary>
    public uint Version { get; private set; }
    public DateTime? RespondedAt { get; private set; }
    public string? ResponseMessage { get; private set; }

    /// <summary>Lista de canciones en texto libre; la edita el manager del toque aceptado.</summary>
    public string? Setlist { get; private set; }

    public TimeOnly? CallTime { get; private set; }

    /// <summary>Anticipo acordado, solo como dato (la app no cobra).</summary>
    public decimal? DepositAmount { get; private set; }

    /// <summary>Cuándo se recibió el anticipo; null mientras no se haya recibido.</summary>
    public DateTime? DepositReceivedAt { get; private set; }

    /// <summary>Cuándo se recibió el saldo; null mientras no se haya recibido.</summary>
    public DateTime? BalanceReceivedAt { get; private set; }

    /// <summary>
    /// Fecha límite del anticipo (S24): un día del calendario, como <see cref="EventDate"/>, no un
    /// instante. Puede existir sin monto: el manager pone el plazo antes de que exista la plata.
    /// </summary>
    public DateOnly? DepositDueDate { get; private set; }

    /// <summary>Fecha límite del saldo (S24), con las mismas reglas que el anticipo.</summary>
    public DateOnly? BalanceDueDate { get; private set; }

    public List<EventRequestMessage> Messages { get; set; } = [];

    /// <summary>Respuestas de asistencia de los miembros del grupo (una por usuario).</summary>
    public List<GigAttendance> Attendance { get; set; } = [];

    /// <summary>Se llama después de guardar (cuando ya hay Id) para avisar al grupo.</summary>
    public void RaiseCreatedEvent()
    {
        AddDomainEvent(new EventRequestCreatedEvent
        {
            EventRequestId = Id,
            GroupId = GroupId,
            ClientUserId = ClientUserId,
            EventDate = EventDate,
            EventKind = EventType
        });
    }

    /// <summary>El grupo acepta la solicitud. Solo desde Pending.</summary>
    public void Accept(string? responseMessage, DateTime nowUtc)
    {
        if (Status != EventRequestStatus.Pending)
            throw new InvalidEventRequestTransitionException(
                $"Solo se puede aceptar una solicitud pendiente; esta está {Describe(Status)}.");

        Respond(EventRequestStatus.Accepted, responseMessage, nowUtc);
    }

    /// <summary>El grupo rechaza la solicitud. Solo desde Pending.</summary>
    public void Decline(string? responseMessage, DateTime nowUtc)
    {
        if (Status != EventRequestStatus.Pending)
            throw new InvalidEventRequestTransitionException(
                $"Solo se puede rechazar una solicitud pendiente; esta está {Describe(Status)}.");

        Respond(EventRequestStatus.Declined, responseMessage, nowUtc);
    }

    /// <summary>
    /// Cancela la solicitud. El cliente puede cancelarla pendiente o aceptada;
    /// el grupo solo puede cancelar una que ya aceptó (para rechazar una pendiente usa Decline).
    /// </summary>
    public void Cancel(EventRequestParty by)
    {
        var allowed = Status switch
        {
            EventRequestStatus.Pending => by == EventRequestParty.Client,
            EventRequestStatus.Accepted => true,
            _ => false
        };

        if (!allowed)
            throw new InvalidEventRequestTransitionException(
                Status == EventRequestStatus.Pending
                    ? "El grupo no puede cancelar una solicitud pendiente; puede rechazarla."
                    : $"No se puede cancelar una solicitud que está {Describe(Status)}.");

        ChangeStatus(EventRequestStatus.Cancelled, by);
    }

    /// <summary>
    /// Guarda o corrige la respuesta de un miembro al toque. Solo un toque aceptado tiene
    /// asistencia y cada usuario tiene una sola fila: si ya respondió, se actualiza la misma.
    /// </summary>
    public GigAttendance RespondAttendance(long userId, GigAttendanceStatus status)
    {
        var attendance = Attendance.FirstOrDefault(a => a.UserId == userId);
        if (attendance is null)
        {
            attendance = new GigAttendance { EventRequestId = Id, UserId = userId };
            Attendance.Add(attendance);
        }

        attendance.Status = status;
        return attendance;
    }

    public void SetSetlist(string? setlist)
        => Setlist = string.IsNullOrWhiteSpace(setlist) ? null : setlist.Trim();

    public void SetCallTime(TimeOnly? callTime) => CallTime = callTime;

    public void SetDepositAmount(decimal? amount) => DepositAmount = amount;

    /// <summary>
    /// Marca el anticipo como recibido (fija la fecha si estaba vacía, sin moverla si ya la había)
    /// o lo marca como no recibido (limpia la fecha).
    /// </summary>
    public void SetDepositReceived(bool received, DateTime nowUtc)
        => DepositReceivedAt = received ? DepositReceivedAt ?? nowUtc : null;

    /// <summary>Igual que el anticipo: fija la fecha si estaba vacía, o la limpia.</summary>
    public void SetBalanceReceived(bool received, DateTime nowUtc)
        => BalanceReceivedAt = received ? BalanceReceivedAt ?? nowUtc : null;

    /// <summary>
    /// Guarda o limpia la fecha límite del anticipo. No se valida contra hoy: un plazo que ya pasó se
    /// registra igual, porque es un hecho y la app no cobra ni reclama nada (D1, D2, S18).
    /// </summary>
    public void SetDepositDueDate(DateOnly? dueDate) => DepositDueDate = dueDate;

    /// <summary>Igual que el anticipo, para la fecha límite del saldo.</summary>
    public void SetBalanceDueDate(DateOnly? dueDate) => BalanceDueDate = dueDate;

    /// <summary>Agrega un mensaje de una de las partes y avisa a la otra.</summary>
    public EventRequestMessage PostMessage(long senderUserId, EventRequestParty senderParty, string body, DateTime nowUtc)
    {
        // Rechazada o cancelada es un estado final: otra fecha es otra solicitud, con su propia respuesta.
        if (Status is EventRequestStatus.Declined or EventRequestStatus.Cancelled)
            throw new InvalidEventRequestTransitionException(
                $"Esta solicitud está {Describe(Status)}. Para hablar de otra fecha, envía una nueva solicitud.");

        var message = new EventRequestMessage
        {
            EventRequestId = Id,
            SenderUserId = senderUserId,
            SenderParty = senderParty,
            Body = body,
            CreatedAt = nowUtc
        };
        Messages.Add(message);

        AddDomainEvent(new EventRequestMessagePostedEvent
        {
            EventRequestId = Id,
            GroupId = GroupId,
            ClientUserId = ClientUserId,
            SenderUserId = senderUserId,
            SenderParty = senderParty
        });

        return message;
    }

    private void Respond(EventRequestStatus newStatus, string? responseMessage, DateTime nowUtc)
    {
        RespondedAt = nowUtc;
        ResponseMessage = string.IsNullOrWhiteSpace(responseMessage) ? null : responseMessage.Trim();
        ChangeStatus(newStatus, EventRequestParty.Group);
    }

    private void ChangeStatus(EventRequestStatus newStatus, EventRequestParty by)
    {
        var old = Status;
        Status = newStatus;

        AddDomainEvent(new EventRequestStatusChangedEvent
        {
            EventRequestId = Id,
            GroupId = GroupId,
            ClientUserId = ClientUserId,
            EventDate = EventDate,
            OldStatus = old,
            NewStatus = newStatus,
            ChangedBy = by,
            IsSelfBooked = IsSelfBooked
        });
    }

    private static string Describe(EventRequestStatus status) => status switch
    {
        EventRequestStatus.Pending => "pendiente",
        EventRequestStatus.Accepted => "aceptada",
        EventRequestStatus.Declined => "rechazada",
        EventRequestStatus.Cancelled => "cancelada",
        _ => status.ToString()
    };
}
