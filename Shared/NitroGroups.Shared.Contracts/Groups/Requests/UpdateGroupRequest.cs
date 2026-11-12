namespace NitroGroups.Shared.Contracts.Groups.Requests
{
    public class UpdateGroupRequest
    {
        public string Slug { get; set; } = string.Empty;
        public string GroupName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Biography { get; set; } = string.Empty;
        public int NumMembers { get; set; }
        public int YearsExperience { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string LocationText { get; set; } = string.Empty;
        public int ServiceRadiusKm { get; set; }
        public string Currency { get; set; } = string.Empty;
        public decimal? BasePrice { get; set; }
        public decimal? HourlyRate { get; set; }
        public int MinimumDurationHours { get; set; }
        public int SetupTimeMinutes { get; set; }
        public bool IsAcceptingBookings { get; set; }
        /// <summary>
        /// Cómo quiere el grupo que se le pague (ronda 9, D1/S18): texto libre de hasta 500
        /// caracteres. Enviarlo vacío lo borra: el campo vacío es cómo el grupo dice que no cargó nada.
        /// </summary>
        public string? PaymentInstructions { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string? CoverImageUrl { get; set; }
    }
}
