namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Qué le avisa el músico al manager: lo que le falta al toque (llegada, pago, setlist) o que llega
/// tarde / no encuentra el lugar (S17). Se guarda como entero: no reordenar ni reutilizar
/// valores (las filas existentes cambiarían de significado). Los nombres son los literales que
/// usa la API ("CallTime" / "Pay" / "Setlist" / "Late" / "CannotFindVenue").
/// </summary>
public enum GigNoticeKind
{
    CallTime = 1,
    Pay = 2,
    Setlist = 3,
    Late = 4,
    CannotFindVenue = 5
}

public static class GigNoticeKinds
{
    /// <summary>Los cinco avisos del contrato, en el orden en que la agenda los muestra.</summary>
    public static readonly IReadOnlyList<GigNoticeKind> All =
        [GigNoticeKind.CallTime, GigNoticeKind.Pay, GigNoticeKind.Setlist, GigNoticeKind.Late, GigNoticeKind.CannotFindVenue];

    /// <summary>"Llego tarde" y "No encuentro el lugar": solo tienen sentido antes del toque.</summary>
    public static bool IsDayOfGig(GigNoticeKind kind) => kind is GigNoticeKind.Late or GigNoticeKind.CannotFindVenue;

    /// <summary>
    /// Lee el tipo del cuerpo de la petición. Solo acepta los literales del contrato, no números
    /// ni mayúsculas distintas: lo demás es un 400.
    /// </summary>
    public static bool TryParse(string? value, out GigNoticeKind kind)
    {
        switch (value)
        {
            case nameof(GigNoticeKind.CallTime):
                kind = GigNoticeKind.CallTime;
                return true;
            case nameof(GigNoticeKind.Pay):
                kind = GigNoticeKind.Pay;
                return true;
            case nameof(GigNoticeKind.Setlist):
                kind = GigNoticeKind.Setlist;
                return true;
            case nameof(GigNoticeKind.Late):
                kind = GigNoticeKind.Late;
                return true;
            case nameof(GigNoticeKind.CannotFindVenue):
                kind = GigNoticeKind.CannotFindVenue;
                return true;
            default:
                kind = default;
                return false;
        }
    }
}
