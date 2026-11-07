namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// La nota de "cómo pagar" del hilo del cliente (ronda 9), la cuarta cosa que le faltaba al
    /// cliente: veía cuánto debía y para cuándo, pero no cómo pagar. La app <b>no cobra</b>, no recibe
    /// dinero ni lo mueve (D1/S18): la nota solo repite cómo dijo el grupo que quiere que se le pague.
    /// </summary>
    /// <remarks>
    /// Ronda 10: es <b>una sola</b> nota autoritativa. Antes eran dos —el acuerdo en efectivo y las
    /// instrucciones del grupo— y el cliente leía "en efectivo" arriba y "transfiere" abajo, en la
    /// misma pantalla. Ahora el método se enuncia una vez: el del grupo cuando escribió, y cuando no
    /// escribió no se inventa ninguno.
    /// </remarks>
    public class CheckoutNoteResponse
    {
        /// <summary>Qué es esta nota: "Cómo pagar".</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// El texto que lee el cliente. Es el único enunciado del método: el texto del grupo tal cual
        /// lo escribió, o —cuando el grupo no escribió nada— la frase que dice con quién se acuerda,
        /// sin nombrar efectivo ni transferencia, porque la app no sabe cómo se van a pagar.
        /// </summary>
        public string Body { get; set; } = string.Empty;

        /// <summary>
        /// Quién atiende el pago: "Te atiende Mónica Salinas." (ronda 10). Va en su propia línea para
        /// que el nombre no se mezcle con el texto del grupo. Null cuando Users no puede dar un nombre
        /// legible: entonces no se dibuja la línea, nunca se escribe un correo.
        /// </summary>
        public string? ManagerLine { get; set; }

        /// <summary>
        /// La línea fija que dice la verdad sobre quién cobra: "Pagas directo al grupo; NitroGroups no
        /// cobra ni interviene." (decisión 4). Se manda en la nota y el bloque la dibuja una sola vez.
        /// </summary>
        public string UserDescription { get; set; } = string.Empty;

        /// <summary>
        /// El día en que el grupo actualizó el texto, en hora de México (decisión 5), para la fecha
        /// de la nota. Null cuando no se puede leer —nadie lo cargó, el grupo nunca cambió el texto o
        /// el grupo no escribió nada— y entonces no se dibuja fecha: no se inventa.
        /// </summary>
        public DateOnly? UpdatedOn { get; set; }
    }
}
