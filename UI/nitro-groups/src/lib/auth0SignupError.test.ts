import { describe, expect, it } from "vitest";
import { signupErrorMessage } from "./auth0SignupError";

describe("signupErrorMessage", () => {
    it("always returns a string, even when Auth0 sends the password policy as an object", () => {
        const message = signupErrorMessage({
            code: "invalid_password",
            description: {
                rules: [
                    { message: "At least %d characters in length", format: [15], code: "lengthAtLeast", verified: false },
                    { message: "Maximum password length exceeded", format: [72], code: "maxLength", verified: true },
                ],
                verified: false,
            },
        });
        expect(typeof message).toBe("string");
        expect(message).toBe("La contraseña no cumple los requisitos: al menos 15 caracteres");
    });

    it("lists only the rules that failed", () => {
        const message = signupErrorMessage({
            code: "invalid_password",
            description: {
                rules: [
                    { message: "At least %d characters in length", format: [10], code: "lengthAtLeast", verified: true },
                    { message: "Maximum password length exceeded", format: [72], code: "maxLength", verified: false },
                ],
            },
        });
        expect(message).toBe("La contraseña no cumple con los requisitos");
    });

    it("keeps a textual password description", () => {
        expect(signupErrorMessage({ code: "invalid_password", description: "Password is too weak" })).toBe(
            "Password is too weak",
        );
    });

    it("keeps the duplicated email message", () => {
        expect(signupErrorMessage({ code: "invalid_signup", description: "Invalid sign up" })).toBe(
            "Este correo ya está registrado",
        );
    });

    it("keeps any other textual description", () => {
        expect(signupErrorMessage({ description: "Connection is disabled" })).toBe("Connection is disabled");
    });

    it("falls back to a generic message", () => {
        expect(signupErrorMessage({})).toBe("Error al crear la cuenta");
        expect(signupErrorMessage(null)).toBe("Error al crear la cuenta");
        expect(signupErrorMessage({ description: { unexpected: true } })).toBe("Error al crear la cuenta");
    });
});
