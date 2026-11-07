namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// Anticipo del toque, registrado como dato (la app no cobra). <c>ReceivedAt</c> es null
    /// mientras no se haya recibido.
    /// </summary>
    public class GigDepositResponse
    {
        public decimal? Amount { get; set; }
        public DateTime? ReceivedAt { get; set; }

        /// <summary>
        /// Fecha límite del anticipo (S24): un día del calendario, como la fecha del evento, no un
        /// instante. Null mientras el grupo no la haya cargado.
        /// </summary>
        public DateOnly? DueDate { get; set; }
    }
}
