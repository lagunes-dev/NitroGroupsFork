namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>Respuesta de <c>POST api/gigs/{id}/attendance</c>: el estado guardado del toque.</summary>
    public class GigAttendanceResponse
    {
        /// <summary>Id del toque (el mismo que va en la ruta).</summary>
        public long Id { get; set; }

        /// <summary>Confirmed o Declined.</summary>
        public string Attendance { get; set; } = string.Empty;
    }
}
