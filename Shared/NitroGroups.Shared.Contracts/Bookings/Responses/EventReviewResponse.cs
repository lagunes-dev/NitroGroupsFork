namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// La reseña tal como la ve el cliente que la escribió: es la respuesta de
    /// <c>POST api/event-requests/{id}/review</c> y el campo <c>review</c> de sus solicitudes.
    /// </summary>
    public class EventReviewResponse
    {
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
