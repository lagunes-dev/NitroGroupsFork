/**
 * Sentence read aloud when a list arrives: the counts are on screen, so this only says the thing
 * that matters — how many requests still wait for an answer.
 */
export function pendingRequestsLine(pending: number, total: number): string {
    if (total <= 0) return "Todavía no tienes pedidos de fecha.";
    if (total === 1) return pending > 0 ? "Tu pedido espera respuesta." : "Tu pedido no espera respuesta.";
    if (pending <= 0) return `Ninguno de tus ${total} pedidos espera respuesta.`;
    if (pending === 1) return `1 de tus ${total} pedidos espera respuesta.`;
    return `${pending} de tus ${total} pedidos esperan respuesta.`;
}
