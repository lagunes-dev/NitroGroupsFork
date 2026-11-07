namespace NitroGroups.Shared.Contracts.Bookings.Requests
{
    /// <summary>
    /// Cuerpo de <c>POST api/gigs/{id}/attendance</c>. El miembro siempre es el usuario del token:
    /// no hay campo de usuario y cualquier "userId" que se envíe se ignora.
    /// </summary>
    public class SetGigAttendanceBody
    {
        /// <summary>"Confirmed" o "Declined". Cualquier otro valor responde 400.</summary>
        public string? Status { get; set; }
    }
}
