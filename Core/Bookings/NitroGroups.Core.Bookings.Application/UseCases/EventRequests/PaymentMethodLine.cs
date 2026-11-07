namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests;

/// <summary>
/// Ronda 10: cómo pagar en una línea, para la fila de la lista del cliente. El texto completo del
/// grupo es una nota del hilo; la fila es una fila y no puede volverse un párrafo, así que se toma la
/// primera línea con texto y se recorta si pasa del tope.
/// </summary>
/// <remarks>
/// La app no interpreta ni resume el método (D1/S18): corta texto, no lo reescribe. Un corte prolijo
/// —en la última palabra completa, con puntos suspensivos— es lo único que agrega.
/// </remarks>
public static class PaymentMethodLine
{
    /// <summary>Cuánto puede medir la línea antes de recortarse, en caracteres.</summary>
    public const int MaxLength = 120;

    private const string Ellipsis = "…";

    /// <summary>
    /// La primera línea con texto del grupo, recortada al tope. Null cuando no hay texto: el campo
    /// vacío no es un dato y la fila no dice nada del método.
    /// </summary>
    public static string? From(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var firstLine = text
            .Split('\n')
            .Select(line => line.Trim())
            .FirstOrDefault(line => line.Length > 0);

        if (firstLine is null)
            return null;

        if (firstLine.Length <= MaxLength)
            return firstLine;

        var cut = firstLine[..MaxLength];
        var lastSpace = cut.LastIndexOf(' ');
        var head = (lastSpace > 0 ? cut[..lastSpace] : cut).TrimEnd(' ', ',', ';', ':', '.');
        return $"{head}{Ellipsis}";
    }
}
