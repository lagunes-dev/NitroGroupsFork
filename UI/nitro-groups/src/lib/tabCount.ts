/** Accessible name of a tab or menu entry with a pending count: "Equipo, 2 pendientes"; just the title at zero. */
export function tabCountLabel(title: string, count?: number): string {
    if (!count || count <= 0) return title;
    return `${title}, ${count} ${count === 1 ? "pendiente" : "pendientes"}`;
}
