// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GroupProfileEdit from "./GroupProfileEdit";
import type { MusicGroup } from "../../types/MusicGroup";

/**
 * S22: el teléfono del grupo es lo que el músico ve en su toque para escribirle al manager. El
 * formulario es el único lugar donde el manager lo carga, y su estado vacío es el interruptor: si
 * no hay número, la tarjeta del toque no dibuja nada. Estas reglas fijan que el campo exista, que
 * diga quién lo ve y que escribirlo llegue al estado que se guarda.
 */
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
    profilePictureUrl: "",
    coverImageUrl: "",
};

function renderForm(set = vi.fn()) {
    render(
        <GroupProfileEdit
            group={GROUP}
            originalGroup={GROUP}
            selectedGenres={[]}
            setSelectedGenres={vi.fn()}
            isPending={false}
            saveError={null}
            genres={[]}
            isGenresLoading={false}
            handleSave={(e) => e.preventDefault()}
            handleCancel={vi.fn()}
            set={set}
        />
    );
    return set;
}

describe("El teléfono del grupo en el formulario del manager (S22)", () => {
    it("shows the phone the group already has loaded", () => {
        renderForm();

        expect(screen.getByLabelText(/Teléfono del grupo/i)).toHaveValue("8110000003");
    });

    it("says who sees the number and that empty means nobody sees it", () => {
        renderForm();

        // La promesa es la de S22: solo el miembro activo lo ve, y el campo vacío es el interruptor.
        expect(screen.getByText(/integrantes activos/i)).toBeInTheDocument();
        expect(screen.getByText(/si lo dejas vacío, nadie lo ve/i)).toBeInTheDocument();
    });

    it("writes into the state that gets saved, never into a field the app ignores", async () => {
        const user = userEvent.setup();

        // El formulario es controlado por el panel: se monta con estado real, como en la app, para
        // probar que lo tecleado llega al estado y no queda en un input muerto.
        function Stateful() {
            const [group, setGroup] = useState(GROUP);
            const set = <K extends keyof MusicGroup>(key: K, value: MusicGroup[K]) =>
                setGroup((current) => ({ ...current, [key]: value }));
            return (
                <GroupProfileEdit
                    group={group}
                    originalGroup={GROUP}
                    selectedGenres={[]}
                    setSelectedGenres={vi.fn()}
                    isPending={false}
                    saveError={null}
                    genres={[]}
                    isGenresLoading={false}
                    handleSave={(e) => e.preventDefault()}
                    handleCancel={vi.fn()}
                    set={set}
                />
            );
        }
        render(<Stateful />);

        const field = screen.getByLabelText(/Teléfono del grupo/i);
        await user.clear(field);
        await user.type(field, "33 1234 5678");

        expect(field).toHaveValue("33 1234 5678");
    });
});
