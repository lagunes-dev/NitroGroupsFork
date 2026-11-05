namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// Reseñas públicas de un grupo, de la más reciente a la más antigua. El resumen se calcula
    /// con las filas reales de reseñas, no con el agregado guardado en el perfil.
    /// </summary>
    public class GroupReviewsResponse
    {
        public GroupReviewSummaryResponse Summary { get; set; } = new();
        public List<GroupReviewItemResponse> Items { get; set; } = [];
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public bool HasNextPage { get; set; }
        public bool HasPreviousPage { get; set; }
    }

    /// <summary>Promedio (dos decimales) y cantidad de reseñas del grupo; 0 y 0 si no hay.</summary>
    public class GroupReviewSummaryResponse
    {
        public decimal Average { get; set; }
        public int Count { get; set; }
    }

    public class GroupReviewItemResponse
    {
        public int Rating { get; set; }
        public string? Comment { get; set; }
        public DateTime CreatedAt { get; set; }
        public string EventType { get; set; } = string.Empty;

        /// <summary>Privacidad: nombre e inicial del apellido ("Ana L."), nunca el correo.</summary>
        public string AuthorName { get; set; } = string.Empty;
    }
}
