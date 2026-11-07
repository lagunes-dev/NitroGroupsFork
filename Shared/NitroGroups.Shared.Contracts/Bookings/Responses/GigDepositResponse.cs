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
    }
}
