namespace NitroGroups.Core.Bookings.Domain.Entities;

/// <summary>
/// Qué le falta al toque según el músico. Se guarda como entero: no reordenar ni reutilizar
/// valores (las filas existentes cambiarían de significado). Los nombres son los literales que
/// usa la API ("CallTime" / "Pay" / "Setlist").
/// </summary>
public enum GigNoticeKind
{
    CallTime = 1,
    Pay = 2,
    Setlist = 3
}

public static class GigNoticeKinds
{
    /// <summary>Los tres avisos del contrato, en el orden en que la agenda los muestra.</summary>
    public static readonly IReadOnlyList<GigNoticeKind> All =
        [GigNoticeKind.CallTime, GigNoticeKind.Pay, GigNoticeKind.Setlist];

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
            default:
                kind = default;
                return false;
        }
    }
}
