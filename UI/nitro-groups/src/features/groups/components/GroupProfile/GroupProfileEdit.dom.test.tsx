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

function renderForm(set = vi.fn(), group: MusicGroup = GROUP) {
    render(
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

describe("Cómo pagar en el formulario del manager (ronda 9)", () => {
    const WITH_INSTRUCTIONS: MusicGroup = { ...GROUP, paymentInstructions: "Efectivo en la oficina, el día del toque." };

    function Stateful({ initial }: { initial: MusicGroup }) {
        const [group, setGroup] = useState(initial);
        const set = <K extends keyof MusicGroup>(key: K, value: MusicGroup[K]) =>
            setGroup((current) => ({ ...current, [key]: value }));
        return (
            <GroupProfileEdit
                group={group}
                originalGroup={initial}
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

    it("shows the text the group already wrote", () => {
        renderForm(vi.fn(), WITH_INSTRUCTIONS);

        expect(screen.getByLabelText(/Cómo pagar/i)).toHaveValue("Efectivo en la oficina, el día del toque.");
    });

    it("counts the characters up to 500 and stops there", async () => {
        const user = userEvent.setup();
        renderForm();

        expect(screen.getByLabelText(/Cómo pagar/i)).toHaveAttribute("maxlength", "500");
        expect(screen.getByText(/0 de 500/)).toBeInTheDocument();

        render(<Stateful initial={GROUP} />);
        const field = screen.getAllByLabelText(/Cómo pagar/i)[1];
        await user.type(field, "Efectivo.");

        // El contador se lee donde el manager escribe: no hay que adivinar cuánto falta.
        expect(screen.getByText(/9 de 500/)).toBeInTheDocument();
    });

    it("says who reads it: only the client of an accepted event", () => {
        renderForm();

        // Ni el perfil público ni el hilo del grupo: es el acuerdo con quien paga.
        expect(screen.getByText(/solo lo ve el cliente de un evento aceptado/i)).toBeInTheDocument();
    });

    // Ronda 10: el campo ayuda a que el texto sirva. Un manager que escribe "transferencia" deja al
    // cliente preguntando por el chat; la ayuda nombra lo que el cliente necesita leer.
    it("nudges what to write: the account, the name on it, where the receipt goes and the concept", () => {
        renderForm();

        const helper = screen.getByText(/solo lo ve el cliente de un evento aceptado/i);
        // Cuenta, titular, comprobante y concepto, en una sola frase.
        expect(helper).toHaveTextContent(/cuenta/i);
        expect(helper).toHaveTextContent(/a nombre de quién va/i);
        expect(helper).toHaveTextContent(/comprobante/i);
        expect(helper).toHaveTextContent(/concepto/i);
        // Sin voseo y sin el contador pegado: el conteo vive en su propia línea anunciada.
        expect(helper).toHaveTextContent(/^Escribe la cuenta/);
    });

    it("writes into the state that gets saved", async () => {
        const user = userEvent.setup();
        render(<Stateful initial={GROUP} />);

        const field = screen.getByLabelText(/Cómo pagar/i);
        await user.clear(field);
        await user.type(field, "Transfiere a la CLABE 0121 8000 1234 5678.");

        expect(field).toHaveValue("Transfiere a la CLABE 0121 8000 1234 5678.");
    });
});

/**
 * Ronda 10: el manager leyó "209 de 500" y no sabía de qué. Un número sin unidad no dice qué se
 * cuenta, y sin anuncio el contador solo existe para quien mira la pantalla.
 */
describe("El contador de Cómo pagar (ronda 10)", () => {
    it("counts characters by name and announces the count politely as it changes", async () => {
        const user = userEvent.setup();

        function Stateful() {
            const [group, setGroup] = useState(GROUP);
            const set = <K extends keyof MusicGroup>(key: K, value: MusicGroup[K]) =>
                setGroup((current) => ({ ...current, [key]: value }));
            return (
                <GroupProfileEdit group={group} originalGroup={GROUP} selectedGenres={[]} setSelectedGenres={vi.fn()}
                    isPending={false} saveError={null} genres={[]} isGenresLoading={false}
                    handleSave={(e) => e.preventDefault()} handleCancel={vi.fn()} set={set} />
            );
        }
        render(<Stateful />);

        const field = screen.getByLabelText(/Cómo pagar/i);
        const counter = screen.getByText("0 de 500 caracteres");
        expect(counter).toHaveAttribute("aria-live", "polite");
        // The count belongs to the field: it is read with the guidance, not instead of it.
        expect(field).toHaveAccessibleDescription(/0 de 500 caracteres/);
        expect(field).toHaveAccessibleDescription(/solo lo ve el cliente de un evento aceptado/i);

        await user.type(field, "Efectivo.");

        expect(screen.getByText("9 de 500 caracteres")).toHaveAttribute("aria-live", "polite");
    });

    it("shows the shape of a good answer while the field is empty", () => {
        renderForm();

        const field = screen.getByLabelText(/Cómo pagar/i);
        // The demo value hides what an empty field asks for; the placeholder shows the shape.
        expect(field).toHaveAttribute("placeholder", expect.stringContaining("CLABE"));
        expect(field).toHaveAttribute("placeholder", expect.stringContaining("a nombre de"));
    });
});
