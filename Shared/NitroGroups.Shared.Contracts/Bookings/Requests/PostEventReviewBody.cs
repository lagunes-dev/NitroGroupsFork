namespace NitroGroups.Shared.Contracts.Bookings.Requests
{
    /// <summary>
    /// Cuerpo de <c>POST api/event-requests/{id}/review</c>. El autor siempre es el usuario del
    /// token: no hay campo de usuario y cualquier "clientUserId" que se envíe se ignora.
    /// </summary>
    public class PostEventReviewBody
    {
        /// <summary>Obligatoria, de 1 a 5 estrellas.</summary>
        public int? Rating { get; set; }

        /// <summary>Opcional, máximo 1000 caracteres.</summary>
        public string? Comment { get; set; }
    }
}
