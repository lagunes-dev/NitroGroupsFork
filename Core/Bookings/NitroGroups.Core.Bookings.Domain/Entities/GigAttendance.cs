using NitroGroups.Shared.Domain;

namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Respuesta de un miembro del grupo a un toque (una solicitud aceptada). Hay una sola fila
/// por (toque, usuario): el índice único de la tabla lo garantiza y el agregado la actualiza
/// en vez de duplicarla.
/// </summary>
public class GigAttendance : AuditableModel
{
    public long EventRequestId { get; set; }
    public long UserId { get; set; }
    public GigAttendanceStatus Status { get; set; }
}
