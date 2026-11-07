namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// Un aviso preestablecido del músico al manager de un toque aceptado (S12). El músico dice que
    /// falta la llegada, el pago o el setlist; nunca escribe texto libre. <c>SentOn</c> es el día en
    /// México en que se mandó: uno por (toque, músico, tipo) y día.
    /// </summary>
    public class GigNoticeResponse
    {
        public long Id { get; set; }

        /// <summary>El toque (solicitud aceptada) al que se refiere el aviso.</summary>
        public long GigId { get; set; }

        /// <summary>El músico que avisó. Nunca viaja su email.</summary>
        public long UserId { get; set; }

        /// <summary>Nombre del músico, para que el manager no tenga que adivinar quién avisó.</summary>
        public string FullName { get; set; } = string.Empty;

        /// <summary>"CallTime", "Pay", "Setlist", "Late" o "CannotFindVenue".</summary>
        public string Kind { get; set; } = string.Empty;

        /// <summary>El día del aviso en México (`YYYY-MM-DD`).</summary>
        public DateOnly SentOn { get; set; }
    }
}
