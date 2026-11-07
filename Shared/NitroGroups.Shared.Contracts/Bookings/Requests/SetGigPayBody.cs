namespace NitroGroups.Shared.Contracts.Bookings.Requests
{
    /// <summary>
    /// Cuerpo de <c>PUT api/groups/{groupId}/gigs/{id}/pay</c>. La lista REEMPLAZA los pagos del
    /// toque: quien no aparece queda sin pago. Es informativo; nunca se compara con el presupuesto.
    /// </summary>
    public class SetGigPayBody
    {
        public List<GigPayItemBody>? Payments { get; set; }
    }

    public class GigPayItemBody
    {
        public long UserId { get; set; }
        public decimal Amount { get; set; }

        /// <summary>
        /// <c>true</c> registra que se le pagó (fija la fecha solo si no la tenía); <c>false</c> la
        /// limpia; omitido conserva lo que ya había. Es un dato: la app no mueve dinero.
        /// </summary>
        public bool? Paid { get; set; }
    }
}
