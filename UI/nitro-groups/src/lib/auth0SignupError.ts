const FALLBACK_MESSAGE = "Error al crear la cuenta";
const GENERIC_PASSWORD_MESSAGE = "La contraseña no cumple con los requisitos";

interface PasswordRule {
    code?: string;
    format?: unknown[];
    verified?: boolean;
}

function failedRuleLabel(rule: PasswordRule): string | null {
    if (rule.code === "lengthAtLeast" && typeof rule.format?.[0] === "number") {
        return `al menos ${rule.format[0]} caracteres`;
    }
    return null;
}

function passwordPolicyMessage(description: unknown): string {
    const rules = (description as { rules?: unknown })?.rules;
    if (!Array.isArray(rules)) return GENERIC_PASSWORD_MESSAGE;

    const labels = (rules as PasswordRule[])
        .filter((rule) => rule.verified === false)
        .map(failedRuleLabel)
        .filter((label): label is string => label !== null);

    return labels.length > 0
        ? `La contraseña no cumple los requisitos: ${labels.join(", ")}`
        : GENERIC_PASSWORD_MESSAGE;
}

/**
 * Turns an Auth0 `/dbconnections/signup` error body into a user-facing string.
 * For `invalid_password` Auth0 may send `description` as a policy object instead of
 * text; rendering that object in React crashes the page, so this always returns a string.
 */
export function signupErrorMessage(auth0Data: unknown): string {
    const data = (auth0Data ?? {}) as { code?: string; description?: unknown };

    if (data.code === "invalid_signup") return "Este correo ya está registrado";

    if (data.code === "invalid_password") {
        return typeof data.description === "string" && data.description
            ? data.description
            : passwordPolicyMessage(data.description);
    }

    return typeof data.description === "string" && data.description ? data.description : FALLBACK_MESSAGE;
}
