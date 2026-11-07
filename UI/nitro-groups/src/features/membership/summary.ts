/** One-line summary of how many groups the user belongs to; empty when there is nothing to say. */
export function membershipSummary(count: number): string {
    if (!Number.isInteger(count) || count < 1) return "";
    return count === 1 ? "Eres miembro de 1 grupo." : `Eres miembro de ${count} grupos.`;
}
