using Cortex.Mediator.Notifications;

namespace NitroGroups.Core.Groups.Application.Events;

/// <summary>
/// Versiones INotification de los eventos de Bookings que consume Groups: el outbox los
/// deserializa a estos tipos (ver <c>EventProvider</c>, que los busca por el nombre de la clase base).
/// </summary>
public class BookingsEvents
{
    public class GroupReviewPostedEvent : Shared.Domain.DomainEvents.Bookings.GroupReviewPostedEvent, INotification { }
}
