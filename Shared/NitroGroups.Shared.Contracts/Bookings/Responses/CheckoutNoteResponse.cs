namespace NitroGroups.Shared.Contracts.Bookings.Responses
{
    /// <summary>
    /// Una nota de "cómo pagar" en el hilo del cliente (ronda 9), la cuarta cosa que le faltaba al
    /// cliente: veía cuánto debía y para cuándo, pero no cómo pagar. La app <b>no cobra</b>, no recibe
    /// dinero ni lo mueve (D1/S18): la nota solo repite cómo dijo el grupo que quiere que se le pague.
    /// </summary>
    /// <remarks>
    /// Son dos y en este orden: la del acuerdo en efectivo, que siempre está para quien puede leer, y
    /// la del grupo, que solo existe cuando el grupo escribió algo en su perfil.
    /// </remarks>
    public class CheckoutNoteResponse
    {
        /// <summary>Qué es esta nota: "Cómo pagar" (el acuerdo) o "Instrucciones del grupo".</summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// El texto que lee el cliente. En la nota del acuerdo es una frase fija con el nombre del
        /// manager cuando se puede leer; en la del grupo es el texto del grupo, tal cual lo escribió.
        /// </summary>
        public string Body { get; set; } = string.Empty;

        /// <summary>
        /// La línea fija que dice la verdad sobre quién cobra: "Pagas directo al grupo; NitroGroups no
        /// cobra ni interviene." (decisión 4). Se repite en cada nota para que cualquiera de ellas se
        /// lea completa sola.
        /// </summary>
        public string UserDescription { get; set; } = string.Empty;

        /// <summary>
        /// El día en que el grupo actualizó el texto, en hora de México (decisión 5), para la fecha
        /// de la nota. Null cuando no se puede leer —nadie lo cargó o el grupo nunca cambió el
        /// texto— y entonces no se dibuja fecha: no se inventa.
        /// </summary>
        public DateOnly? UpdatedOn { get; set; }
    }
}
