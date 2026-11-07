import { apiClient } from "@/lib/api-client";
import type { CheckoutNotePayload } from "./checkoutNotes";
import type { EventRequestSignals } from "./signals";
import type { CreateEventRequestBody, EventRequest, EventRequestStatus, EventReview } from "./types";

/** API de solicitudes de evento. El usuario siempre sale del token (apiClient lo adjunta). */
export const bookingsService = {
    create: async (body: CreateEventRequestBody) =>
        (await apiClient.post<EventRequest>("/event-requests", body)).data,

    mine: async () => (await apiClient.get<EventRequest[]>("/event-requests/mine")).data,

    forGroup: async (groupId: number, status?: EventRequestStatus) =>
        (await apiClient.get<EventRequest[]>(`/groups/${groupId}/event-requests`, { params: status ? { status } : undefined })).data,

    get: async (id: number) => (await apiClient.get<EventRequest>(`/event-requests/${id}`)).data,

    accept: async (id: number, message?: string) =>
        (await apiClient.post<EventRequest>(`/event-requests/${id}/accept`, { message })).data,

    decline: async (id: number, message?: string) =>
        (await apiClient.post<EventRequest>(`/event-requests/${id}/decline`, { message })).data,

    cancel: async (id: number) => (await apiClient.post<EventRequest>(`/event-requests/${id}/cancel`)).data,

    postMessage: async (id: number, body: string) =>
        (await apiClient.post(`/event-requests/${id}/messages`, { body })).data,

    /** D7: the client's review of an accepted event that already happened (one per event). */
    review: async (id: number, body: { rating: number; comment?: string }) =>
        (await apiClient.post<EventReview>(`/event-requests/${id}/review`, body)).data,

    /**
     * Ronda 9: cómo pagar. Solo el cliente de un evento aceptado lo puede leer; cualquier otro caso
     * responde 404, igual que el detalle del pedido. La app no cobra ni interviene.
     */
    checkoutNotes: async (id: number) =>
        (await apiClient.get<CheckoutNotePayload[]>(`/event-requests/${id}/checkout-notes`)).data,

    /** D6: the day clash and the budget comparison of one request of that group. */
    signals: async (groupId: number, id: number) =>
        (await apiClient.get<EventRequestSignals>(`/groups/${groupId}/event-requests/${id}/signals`)).data,
};

/** Mensaje de error de la API (ProblemDetails) en lenguaje de la interfaz. */
export function apiErrorMessage(error: unknown, fallback: string): string {
    const data = (error as { response?: { data?: { detail?: string; title?: string; errors?: Record<string, string[]> } } })?.response?.data;
    if (data?.errors) return Object.values(data.errors).flat()[0] ?? fallback;
    return data?.detail || data?.title || fallback;
}
