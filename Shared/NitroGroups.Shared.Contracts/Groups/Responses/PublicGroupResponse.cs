namespace NitroGroups.Shared.Contracts.Groups.Responses
{
    /// <summary>
    /// El perfil público de un grupo (<c>GET api/groups/slug/{slug}</c>, sin autenticación): lo que
    /// ve cualquier visitante. Es una copia deliberada de <see cref="GroupResponse"/> menos los
    /// campos que solo son del manager: <c>paymentInstructions</c>, y desde la ronda 13 también el
    /// teléfono y el correo del grupo.
    /// </summary>
    /// <remarks>
    /// Existe porque el perfil público no puede crecer con datos que no le tocan. Cómo pagar es un
    /// acuerdo entre el grupo y su cliente (ronda 9): el visitante anónimo no lo lee, y una respuesta
    /// que no declara el campo lo garantiza también en el JSON, no solo en la pantalla.
    /// El teléfono es del miembro activo (S22) y el correo no lo necesita ningún visitante: la ronda 13
    /// midió que este endpoint anónimo devolvía los dos y que Next los incrustaba en el HTML de la
    /// página pública, aunque ningún componente los pintara. Que la pantalla no lo muestre no es
    /// lo mismo que que no viaje.
    /// </remarks>
    public class PublicGroupResponse
    {
        public long Id { get; set; }
        public long OwnerUserId { get; set; }
        public string Slug { get; set; } = string.Empty;
        public string GroupName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Biography { get; set; } = string.Empty;
        public int NumMembers { get; set; }
        public int YearsExperience { get; set; }
        public string LocationText { get; set; } = string.Empty;
        public int ServiceRadiusKm { get; set; }
        public string Currency { get; set; } = string.Empty;
        public decimal? BasePrice { get; set; }
        public decimal? HourlyRate { get; set; }
        public int MinimumDurationHours { get; set; }
        public int SetupTimeMinutes { get; set; }
        public decimal AverageRating { get; set; }
        public int TotalReviews { get; set; }
        public int ViewCount { get; set; }
        public int BookingCount { get; set; }
        public bool IsVerified { get; set; }
        public bool IsFeatured { get; set; }
        public bool IsAcceptingBookings { get; set; }
        public bool Active { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string? CoverImageUrl { get; set; }

        public List<GenreResponse> Genres { get; set; } = [];
        public List<GroupMediaResponse> Media { get; set; } = [];
    }
}
