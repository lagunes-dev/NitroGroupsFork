import { apiErrorMessage } from "@/features/bookings/bookings.service";

type ErrorBody = { error?: string; detail?: string };

/** Mensaje en español para los fallos documentados de invitaciones y solicitudes. */
export function membershipErrorMessage(error: unknown, fallback: string): string {
    const response = (error as { response?: { status?: number; data?: ErrorBody } })?.response;
    const serverText = response?.data?.detail || response?.data?.error;
    switch (response?.status) {
        case 409:
            return serverText || "Esta acción ya no es posible: el músico ya es miembro, ya hay una respuesta pendiente o no está abierto a unirse.";
        case 403:
            return "No tienes permiso para hacer esto en este grupo.";
        case 404:
            return "No encontramos lo que buscabas. Puede que ya no exista; actualiza la lista.";
        default:
            return apiErrorMessage(error, fallback);
    }
}

/** Failures of "ask to join" on the public group profile (403 = the account is a Client). */
export function joinRequestErrorMessage(error: unknown, fallback: string): string {
    const response = (error as { response?: { status?: number; data?: ErrorBody } })?.response;
    const serverText = response?.data?.detail || response?.data?.error;
    switch (response?.status) {
        case 409:
            return serverText || "Ya eres miembro de este grupo, ya tienes una solicitud pendiente o el grupo no está activo.";
        case 403:
            return "Solo las cuentas de músico pueden pedir unirse a un grupo.";
        case 404:
            return "Este grupo ya no está disponible.";
        default:
            return apiErrorMessage(error, fallback);
    }
}
