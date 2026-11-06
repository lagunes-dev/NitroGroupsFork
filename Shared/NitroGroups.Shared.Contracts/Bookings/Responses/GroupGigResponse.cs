namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// La fila de la agenda del miembro más lo que respondió cada miembro
    /// (<c>GET api/groups/{groupId}/gigs</c>).
    /// </summary>
    public class GroupGigResponse : GigBaseResponse
    {
        public GigDepositResponse Deposit { get; set; } = new();

        public List<GigAttendeeResponse> Attendees { get; set; } = [];

        /// <summary>Cuándo se recibió el saldo del cliente; null mientras no.</summary>
        public DateTime? BalanceReceivedAt { get; set; }

        /// <summary>
        /// Lo que el cliente ofrece por este toque (el cachet), o null si no lo cargó. Solo viaja en la
        /// fila del manager: la del músico y la del cliente conservan su contrato. El servidor no suma
        /// ni valida nada con él (D1 y D2).
        /// </summary>
        public decimal? Budget { get; set; }

        /// <summary>Moneda del pedido, con la que el manager cuenta el cachet y los pagos.</summary>
        public string Currency { get; set; } = "MXN";
    }

    /// <summary>Una respuesta de asistencia, con el nombre del miembro y sin su email.</summary>
    public class GigAttendeeResponse
    {
        public long UserId { get; set; }
        public string FullName { get; set; } = string.Empty;

        /// <summary>Confirmed o Declined.</summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>Lo que se le paga a este miembro por el toque, o null si no tiene pago.</summary>
        public decimal? Pay { get; set; }

        /// <summary>Cuándo el manager registró que se le pagó; null mientras no.</summary>
        public DateTime? PaidAt { get; set; }
    }
}
