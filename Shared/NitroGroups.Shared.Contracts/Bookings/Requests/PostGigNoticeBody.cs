namespace NitroGroups.Shared.Contracts.Bookings.Requests
{
    /// <summary>
    /// Cuerpo de <c>POST api/groups/{groupId}/gigs/{id}/notices</c>: el aviso preestablecido del
    /// músico al manager. Lleva solo el tipo —"CallTime", "Pay", "Setlist", "Late" o "CannotFindVenue"— y nada más: no hay
    /// texto libre, para que el canal no se convierta en un chat.
    /// </summary>
    public class PostGigNoticeBody
    {
        public string? Kind { get; set; }
    }
}
