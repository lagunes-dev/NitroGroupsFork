namespace NitroGroups.Shared.Domain.DomainEvents.Bookings
{
    /// <summary>
    /// El cliente calificó un toque ya pasado. Groups lo consume para actualizar el agregado
    /// del perfil (promedio y cantidad de reseñas) de forma incremental: solo se crean reseñas.
    /// </summary>
    public class GroupReviewPostedEvent : IDomainEvent
    {
        public Guid EventId { get; set; } = Guid.NewGuid();
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public string EventType => nameof(GroupReviewPostedEvent);

        public long GroupId { get; set; }
        public int Rating { get; set; }
    }
}
