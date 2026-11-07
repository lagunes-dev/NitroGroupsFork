// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import GroupProfileView from "./GroupProfileView";
import type { MusicGroup } from "../../types/MusicGroup";

vi.mock("@/features/groupAvailability/components/GroupCalendar", () => ({ default: () => <div>Calendario</div> }));

const PAYMENT = "Transferencia a la CLABE 0121 8000 1234 5678, BBVA, a nombre de Mónica Salinas. Manda el comprobante por el hilo del pedido con el concepto del evento: así el grupo lo registra el mismo día.";

const GROUP: MusicGroup = {
    id: 1,
    ownerUserId: 9,
    slug: "versatil-rock-y-pop",
    groupName: "Versátil Rock y Pop",
    description: "Banda versátil.",
    biography: "Desde 2010.",
    numMembers: 4,
    yearsExperience: 7,
    phone: "8110000003",
    email: "grupo@versatil.mx",
    locationText: "Guadalajara, Jalisco",
    serviceRadiusKm: 100,
    currency: "MXN",
    basePrice: 12000,
    hourlyRate: 2500,
    minimumDurationHours: 2,
    setupTimeMinutes: 30,
    averageRating: 3.5,
    totalReviews: 2,
    viewCount: 0,
    bookingCount: 8,
    isVerified: false,
    isFeatured: false,
    isAcceptingBookings: true,
    active: true,
    paymentInstructions: PAYMENT,
};

function renderView(group: MusicGroup = GROUP, isPublic = false) {
    return render(<GroupProfileView group={group} isPublic={isPublic} toggleEdit={vi.fn()} />);
}

/**
 * Ronda 10: el perfil del grupo se leía sin el teléfono ni "Cómo pagar". Los dos campos solo existían
 * dentro del formulario, a 3.1 y 3.2 pantallas de scroll: revisar un número obligaba a abrir el editor.
 * Una lectura no puede exigir un formulario.
 */
describe("El teléfono y cómo pagar en la lectura del perfil (ronda 10)", () => {
    it("shows the phone and the payment text without opening the form", () => {
        renderView();

        expect(screen.getByText("Teléfono del grupo")).toBeInTheDocument();
        expect(screen.getByText("8110000003")).toBeInTheDocument();
        expect(screen.getByText("Cómo pagar")).toBeInTheDocument();
        expect(screen.getByText(PAYMENT)).toBeInTheDocument();
        // Reading never becomes editing: there is no submit control in the read view.
        expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("keeps a long payment text to two lines and leaves the whole text readable", () => {
        renderView();

        const payment = screen.getByText(PAYMENT);
        expect(payment).toHaveClass("line-clamp-2");
        // The truncated line still carries the whole text: nothing is cut without a way to read it.
        expect(payment).toHaveAttribute("title", PAYMENT);
        // No control inside the payment text: it is the group's words, not an action.
        expect(payment.closest("a, button, input, textarea, select")).toBeNull();
    });

    it("says who sees each field, because both are restricted (S22)", () => {
        renderView();

        expect(screen.getByText(/solo los integrantes activos de tu grupo/i)).toBeInTheDocument();
        expect(screen.getByText(/solo el cliente de un evento aceptado/i)).toBeInTheDocument();
    });

    it("never shows them in the public profile", () => {
        renderView(GROUP, true);

        // S22: the phone is for active members, and how to pay for the client of an accepted event.
        expect(screen.queryByText("Teléfono del grupo")).toBeNull();
        expect(screen.queryByText("8110000003")).toBeNull();
        expect(screen.queryByText("Cómo pagar")).toBeNull();
        expect(screen.queryByText(PAYMENT)).toBeNull();
    });

    it("shows the honest empty state when the group has not loaded them", () => {
        renderView({ ...GROUP, phone: "", paymentInstructions: "" });

        // Two labels, two empty values: the gap is visible instead of hidden.
        expect(screen.getByText("Teléfono del grupo")).toBeInTheDocument();
        expect(screen.getAllByText("Sin definir")).toHaveLength(2);
    });
});
