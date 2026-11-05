namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// D6: las dos señales que el manager ve en el hilo de una solicitud, calculadas con datos que
    /// ya existen. La app no cobra, no suma y no mueve dinero: solo compara dos números.
    /// </summary>
    public class EventRequestSignalsResponse
    {
        public DateClashSignalResponse DateClash { get; set; } = new();
        public BudgetSignalResponse Budget { get; set; } = new();
    }

    /// <summary>
    /// true cuando el grupo ya tiene otro toque aceptado el mismo día del evento; <c>WithGig</c>
    /// nombra ese otro evento y es null cuando no hay choque.
    /// </summary>
    public class DateClashSignalResponse
    {
        public bool Clashes { get; set; }
        public ClashingGigResponse? WithGig { get; set; }
    }

    /// <summary>El otro toque del día, sin datos de contacto del cliente.</summary>
    public class ClashingGigResponse
    {
        public long Id { get; set; }
        public string EventType { get; set; } = string.Empty;
        public string LocationText { get; set; } = string.Empty;
    }

    /// <summary>
    /// Lo que ofrece el cliente (<c>Offered</c>) frente al "desde $X" del grupo (<c>BaseRate</c>).
    /// <c>Status</c> es Above, Below, Equal, o Unknown cuando falta alguno de los dos números.
    /// </summary>
    public class BudgetSignalResponse
    {
        public const string StatusAbove = "Above";
        public const string StatusBelow = "Below";
        public const string StatusEqual = "Equal";
        public const string StatusUnknown = "Unknown";

        public decimal? Offered { get; set; }
        public decimal? BaseRate { get; set; }
        public string Status { get; set; } = StatusUnknown;
    }
}
