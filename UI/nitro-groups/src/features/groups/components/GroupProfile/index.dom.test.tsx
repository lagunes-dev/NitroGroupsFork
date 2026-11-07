// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import GroupProfile from "./index";
import type { MusicGroup } from "../../types/MusicGroup";

/**
 * Ronda 9: el manager carga "cómo pagar" en su perfil y el campo viaja en el guardado. Sin esta
 * línea del payload el campo existiría en pantalla y no se guardaría nunca: la mitad del trato que
 * el cliente necesita para pagar.
 */
const mocks = vi.hoisted(() => ({
    getByUserId: vi.fn(),
    update: vi.fn(),
    assignGenres: vi.fn(),
    listGenres: vi.fn(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
    useCurrentUser: () => ({ user: { id: 9, userType: "Manager" }, isLoading: false, isError: false }),
}));

vi.mock("../../services/groups.service", () => ({
    groupsService: {
        getByUserId: mocks.getByUserId,
        update: mocks.update,
        assignGenres: mocks.assignGenres,
        listGenres: mocks.listGenres,
    },
}));

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
    paymentInstructions: "",
};

describe("El guardado del perfil del grupo (ronda 9)", () => {
    it("sends cómo pagar with the rest of the profile", async () => {
        const user = userEvent.setup();
        mocks.listGenres.mockResolvedValue([]);
        mocks.update.mockResolvedValue(GROUP);
        mocks.assignGenres.mockResolvedValue(undefined);
        mocks.getByUserId.mockResolvedValue(GROUP);

        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        render(
            <QueryClientProvider client={client}>
                <GroupProfile mode="private" initialGroup={GROUP} />
            </QueryClientProvider>
        );

        await user.click(screen.getByRole("button", { name: /Editar perfil/i }));
        const field = screen.getByLabelText(/Cómo pagar/i);
        await user.type(field, "Efectivo el día del toque.");
        await user.click(screen.getByRole("button", { name: /Guardar cambios/i }));

        // Igual que el teléfono: el campo del formulario entra en el payload del guardado.
        expect(mocks.update).toHaveBeenCalledWith(1, expect.objectContaining({
            paymentInstructions: "Efectivo el día del toque.",
        }));
    });
});
