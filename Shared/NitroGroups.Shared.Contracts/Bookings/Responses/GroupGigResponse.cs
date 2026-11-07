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
    }
}
