namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Respuesta de un miembro a un toque. Se guarda como entero: no reordenar ni reutilizar
/// valores (las filas existentes cambiarían de significado). Los nombres son los literales
/// que usa la API ("Confirmed" / "Declined").
/// </summary>
public enum GigAttendanceStatus
{
    Confirmed = 0,
    Declined = 1
}

public static class GigAttendanceStatuses
{
    /// <summary>
    /// Lee el estado del cuerpo de la petición. Solo acepta los literales del contrato, no
    /// números ni mayúsculas distintas: lo demás es un 400.
    /// </summary>
    public static bool TryParse(string? value, out GigAttendanceStatus status)
    {
        switch (value)
        {
            case nameof(GigAttendanceStatus.Confirmed):
                status = GigAttendanceStatus.Confirmed;
                return true;
            case nameof(GigAttendanceStatus.Declined):
                status = GigAttendanceStatus.Declined;
                return true;
            default:
                status = default;
                return false;
        }
    }
}
