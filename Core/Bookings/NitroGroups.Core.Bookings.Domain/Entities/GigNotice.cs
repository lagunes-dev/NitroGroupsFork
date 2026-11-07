using NitroGroups.Shared.Domain;

namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Aviso preestablecido de un músico al manager de un toque aceptado: falta la llegada, el pago o
/// el setlist (S12). No lleva texto libre. Hay una sola fila por (toque, músico, tipo) y día —el
/// índice único de la tabla lo garantiza— para que apretar dos veces no spammee al manager.
/// </summary>
public class GigNotice : AuditableModel
{
    public long EventRequestId { get; set; }
    public long UserId { get; set; }
    public GigNoticeKind Kind { get; set; }

    /// <summary>El día del aviso en hora de México: es la ventana de "uno por día".</summary>
    public DateOnly SentOn { get; set; }
}
