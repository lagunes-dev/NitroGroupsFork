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
    }
}
