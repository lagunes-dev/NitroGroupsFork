using NitroGroups.Shared.Domain;
using NitroGroups.Shared.Domain.DomainEvents.Bookings;

namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Reseña que escribe el cliente de un evento aceptado y ya pasado. Hay una sola por evento:
/// el índice único de la tabla lo garantiza. La escribe solo el cliente del evento (S5).
/// </summary>
public class EventReview : AuditableModel
{
    public const int MinRating = 1;
    public const int MaxRating = 5;
    public const int MaxCommentLength = 1000;

    public long EventRequestId { get; set; }
    public long ClientUserId { get; set; }
    public long GroupId { get; set; }

    /// <summary>De 1 a 5 estrellas (se guarda como smallint con CHECK en la base).</summary>
    public int Rating { get; set; }

    /// <summary>Opcional, máximo <see cref="MaxCommentLength"/> caracteres.</summary>
    public string? Comment { get; set; }

    /// <summary>Avisa a Groups para que actualice el agregado del perfil (por el outbox).</summary>
    public void RaisePostedEvent()
        => AddDomainEvent(new GroupReviewPostedEvent { GroupId = GroupId, Rating = Rating });
}
