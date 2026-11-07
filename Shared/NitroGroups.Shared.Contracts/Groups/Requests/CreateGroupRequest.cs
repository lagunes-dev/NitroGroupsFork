namespace NitroGroups.Shared.Contracts.Groups.Requests
{
    public class CreateGroupRequest
    {
        /// <summary>Ignorado: el dueño es siempre el usuario autenticado. Se mantiene por compatibilidad.</summary>
        public long OwnerUserId { get; set; }
        public string Slug { get; set; } = string.Empty;
        public string GroupName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Biography { get; set; } = string.Empty;
        public int NumMembers { get; set; } = 1;
        public int YearsExperience { get; set; }
        public string Phone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string LocationText { get; set; } = string.Empty;
        public int ServiceRadiusKm { get; set; } = 50;
        public string Currency { get; set; } = "MXN";
        public decimal? BasePrice { get; set; }
        public decimal? HourlyRate { get; set; }
        public int MinimumDurationHours { get; set; } = 2;
        public int SetupTimeMinutes { get; set; } = 30;

        /// <summary>
        /// Cómo quiere el grupo que se le pague (ronda 9, D1/S18): texto libre de hasta 500
        /// caracteres. Solo lo lee el cliente de un evento aceptado, en el hilo del pedido.
        /// </summary>
        public string? PaymentInstructions { get; set; }
        public bool IsAcceptingBookings { get; set; } = true;
        public bool Active { get; set; } = true;
    }
}
