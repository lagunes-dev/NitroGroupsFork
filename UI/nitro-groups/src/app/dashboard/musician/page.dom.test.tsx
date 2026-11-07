// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * El panel del grupo es una página de composición: acá se fija el orden de los bloques que produce
 * el arranque a 390 px (T42). Las pestañas reales se usan tal cual; el perfil se sustituye por un
 * bloque alto para no depender de la tarjeta.
 */
vi.mock("@/hooks/useCurrentUser", () => ({
    useCurrentUser: () => ({ user: { id: 7, userType: "Musician" }, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/usePendingMembership", () => ({ usePendingMembership: () => ({ invitations: 0, joinRequests: 0 }) }));
const ownedGroup = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/useMyMemberships", () => ({ useMyMemberships: () => ({ data: [] }) }));
vi.mock("@/features/groups/types/User", () => ({ UserTypeEnum: { Musician: "Musician", Client: "Client" } }));
vi.mock("@/features/groups/services/groups.service", () => ({
    groupsService: {
        getByUserId: async () =>
            ownedGroup.value
                ? { id: 3, groupName: "Versátil Rock y Pop", isAcceptingBookings: true, genres: [] }
                : null,
    },
}));
vi.mock("@/features/groups/components/GroupProfile", () => ({
    default: ({ startInEdit }: { startInEdit?: boolean }) => (
        <div>{startInEdit ? "Formulario del perfil del grupo" : "Tarjeta del perfil del grupo"}</div>
    ),
}));
vi.mock("@/features/groupAvailability/components/GroupCalendar", () => ({ default: () => <div>Calendario</div> }));
vi.mock("@/features/groupMedia/components/GroupGallery", () => ({ default: () => <div>Galería</div> }));
vi.mock("@/features/bookings/components/GroupInbox", () => ({ GroupInbox: () => <div>Pedidos de fecha</div> }));
vi.mock("@/features/gigs/components", () => ({
    GroupAgenda: () => <div>Agenda del grupo</div>,
    MyAgenda: () => <div>Mi agenda</div>,
}));
vi.mock("@/features/gigs/gigs.queries", () => ({ useConfirmedGigDates: () => [] }));
vi.mock("@/features/membership/components/TeamTab", () => ({ TeamTab: () => <div>Equipo</div> }));
vi.mock("@/features/membership/components/ProfileVisits", () => ({ ProfileVisits: () => null }));
vi.mock("@/features/membership/components/MyInvitations", () => ({ MyInvitations: () => <div>Invitaciones</div> }));
vi.mock("@/features/membership/components/MyGroups", () => ({ MyGroups: () => <div>Mis grupos</div> }));
vi.mock("@/features/musicians/components/MusicianProfileForm", () => ({
    MusicianProfileForm: () => <div>Mi perfil</div>,
}));

import { beforeEach } from "vitest";
import MusicianDashboardPage from "./page";

beforeEach(() => {
    ownedGroup.value = true;
    window.location.hash = "";
});

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <MusicianDashboardPage />
        </QueryClientProvider>
    );
}

describe("musician dashboard at 390 px", () => {
    it("keeps the profile folded above the tabs so the pending work is on the first screen", async () => {
        renderPage();

        const toggle = await screen.findByRole("button", { name: "Perfil del grupo" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");

        const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
        expect(panel).not.toBeNull();
        // La tarjeta entera sigue en la página, plegada, y abierta desde `md`.
        expect(panel).toHaveClass("hidden");
        expect(panel).toHaveClass("md:block");
        expect(screen.getByText("Tarjeta del perfil del grupo")).toBeInTheDocument();

        // El trabajo pendiente viene después del resumen, no de una pantalla de tarjeta.
        const tablist = await screen.findByRole("tablist");
        expect(toggle.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole("tab", { name: /Pedidos/ })).toBeInTheDocument();
        // El resumen dice de qué grupo es el panel en cuanto el grupo llega.
        expect(await screen.findByText("Versátil Rock y Pop")).toBeInTheDocument();
    });

    it("opens the whole profile when the manager asks for it", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.click(await screen.findByRole("button", { name: "Perfil del grupo" }));

        const close = screen.getByRole("button", { name: "Ocultar perfil del grupo" });
        expect(close).toHaveAttribute("aria-expanded", "true");
        expect(document.getElementById(close.getAttribute("aria-controls") ?? "")).toHaveClass("block");
        // Nada de lo que había arriba se perdió: la tarjeta entera está ahí.
        expect(screen.getByText("Tarjeta del perfil del grupo")).toBeVisible();
        // Leer el perfil no abre el formulario: son dos acciones distintas (ronda 10).
        expect(screen.queryByText("Formulario del perfil del grupo")).toBeNull();
    });

    it("opens the group profile in edit mode in one tap, next to reading it", async () => {
        const user = userEvent.setup();
        renderPage();

        await screen.findByText("Tarjeta del perfil del grupo");
        // Una pulsación desde el panel: el formulario del grupo, sin pasar por la ficha.
        await user.click(screen.getByRole("button", { name: "Editar perfil del grupo" }));

        expect(await screen.findByText("Formulario del perfil del grupo")).toBeVisible();
        const close = screen.getByRole("button", { name: "Ocultar perfil del grupo" });
        expect(close).toHaveAttribute("aria-expanded", "true");
    });

    it("gives the manager the form again after it was closed", async () => {
        const user = userEvent.setup();
        renderPage();

        const edit = await screen.findByRole("button", { name: "Editar perfil del grupo" });
        await user.click(edit);
        await user.click(screen.getByRole("button", { name: "Ocultar perfil del grupo" }));
        await user.click(screen.getByRole("button", { name: "Editar perfil del grupo" }));

        // La segunda pulsación vuelve a pedir el formulario, no un panel ya abierto en modo lectura.
        expect(await screen.findByText("Formulario del perfil del grupo")).toBeVisible();
    });
});

describe("musician dashboard for a user who manages no group (T44)", () => {
    it("does not offer the group card, its fold button or any 'Tu grupo' heading", async () => {
        ownedGroup.value = false;
        renderPage();

        await screen.findByRole("tablist");
        expect(screen.queryByText("Tarjeta del perfil del grupo")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /perfil/i })).not.toBeInTheDocument();
        expect(screen.queryByText("Tu grupo")).not.toBeInTheDocument();
        // What a member does use stays reachable.
        expect(screen.getByRole("tab", { name: /Mi agenda/ })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Invitaciones/ })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Perfil|Mi perfil/ })).toBeInTheDocument();
    });
});

describe("musician dashboard honours the tab in the hash (T45)", () => {
    it("opens Invitaciones from #invitaciones", async () => {
        window.location.hash = "#invitaciones";
        renderPage();
        const tab = await screen.findByRole("tab", { name: /Invitaciones/ });
        await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
    });
    it("follows a hash change while the panel is already open", async () => {
        renderPage();
        const tab = await screen.findByRole("tab", { name: /Invitaciones/ });
        expect(tab).toHaveAttribute("aria-selected", "false");
        act(() => {
            window.location.hash = "#invitaciones";
        });
        await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
    });
    it("without a hash opens the first tab as before", async () => {
        renderPage();
        expect(await screen.findByRole("tab", { name: /Pedidos/ })).toHaveAttribute("aria-selected", "true");
    });
});

describe("musician dashboard reacts to the header link inside the panel (T45)", () => {
    /** What Next's <Link> does on a same-page click: pushState, no hashchange. */
    function HeaderLink() {
        return (
            <a
                href="/dashboard/musician#invitaciones"
                onClick={(event) => {
                    event.preventDefault();
                    window.history.pushState(null, "", "/dashboard/musician#invitaciones");
                }}
            >
                Ir a invitaciones
            </a>
        );
    }
    function renderWithHeader() {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        return render(
            <QueryClientProvider client={client}>
                <HeaderLink />
                <MusicianDashboardPage />
            </QueryClientProvider>
        );
    }

    it("switches to Invitaciones when the link is pressed with a different hash", async () => {
        renderWithHeader();
        const tab = await screen.findByRole("tab", { name: /Invitaciones/ });
        expect(tab).toHaveAttribute("aria-selected", "false");
        await userEvent.click(screen.getByText("Ir a invitaciones"));
        await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
    });
    it("switches again when the hash already says #invitaciones but the user moved by hand", async () => {
        renderWithHeader();
        const tab = await screen.findByRole("tab", { name: /Invitaciones/ });
        await userEvent.click(screen.getByText("Ir a invitaciones"));
        await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
        await userEvent.click(screen.getByRole("tab", { name: /Agenda/ }));
        expect(tab).toHaveAttribute("aria-selected", "false");
        await userEvent.click(screen.getByText("Ir a invitaciones"));
        await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
    });
    it("reflects a manual tab switch in the hash without adding a history entry", async () => {
        renderPage();
        const before = window.history.length;
        await userEvent.click(await screen.findByRole("tab", { name: /Equipo/ }));
        expect(window.location.hash).toBe("#equipo");
        expect(window.history.length).toBe(before);
    });
    it("still lands on the tab named by the hash on arrival", async () => {
        window.location.hash = "#equipo";
        renderPage();
        const tab = await screen.findByRole("tab", { name: /Equipo/ });
        await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
    });
});
