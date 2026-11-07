using NitroGroups.Shared.Domain;

namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Lo que se le paga a un músico por un toque. Es solo un dato informativo: la app no mueve
/// dinero ni lo compara con el presupuesto. Hay una sola fila por (toque, usuario); el índice
/// único de la tabla lo garantiza.
/// </summary>
public class GigPay : AuditableModel
{
    public long EventRequestId { get; set; }
    public long UserId { get; set; }
    public decimal Amount { get; set; }

    /// <summary>Cuándo el manager registró que se le pagó; null mientras no.</summary>
    public DateTime? PaidAt { get; set; }
}
