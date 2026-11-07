export type SessionUserType = "client" | "musician";

/**
 * Normalizes the user type the backend returns (enum name or number, depending on serialization)
 * to the value the dashboard redirect reads from the session. Unknown input gives undefined.
 */
export function sessionUserType(value: unknown): SessionUserType | undefined {
    const text = typeof value === "string" ? value.trim().toLowerCase() : value;
    if (text === 0 || text === "0" || text === "client") return "client";
    if (text === 1 || text === "1" || text === "musician") return "musician";
    return undefined;
}
