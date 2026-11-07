/**
 * Event types reach the API as English values ("Wedding", "Corporate"…) and every screen is in
 * Spanish, so one map decides how each one reads. A value the map does not know is printed as it
 * arrived: a new type never turns into an empty label or a guess.
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
    wedding: "Boda",
    corporate: "Corporativo",
    birthday: "Cumpleaños",
    "quinceañera": "XV años",
    // The same type without the tilde: people and old fixtures write it both ways.
    quinceanera: "XV años",
    ceremony: "Ceremonia",
    other: "Otro",
};

/** How the UI prints an event type: the Spanish name for a known value, the value itself otherwise. */
export function eventTypeLabel(value: string | null | undefined): string {
    const raw = (value ?? "").trim();
    if (!raw) return "";
    return EVENT_TYPE_LABELS[raw.toLowerCase()] ?? raw;
}
