// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Header from "./Header";
import Footer from "./Footer";
import { MobileMenu } from "./MobileMenu";

/**
 * Ronda 12 (la clienta): "a t≈0.6 s de cada carga, estando dentro, se lee 'Entrar / Crear cuenta' y
 * 'Cargando la solicitud…', luego cambia. Puede asustar a una clienta." Mientras la sesión no se sabe,
 * ni la cabecera ni el pie afirman que estás fuera: reservan el espacio y revelan la acción cuando la
 * sesión se conoce, sin salto de layout.
 */
interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: { sub: string; email: string; name?: string } | null;
}

interface CurrentUserState {
    user: { id: number; userType: string; firstName?: string } | null;
    auth0User: AuthState["user"];
    isLoading: boolean;
    isError: boolean;
    error: null;
}

const session = vi.hoisted(() => ({
    auth: { isLoading: true, isAuthenticated: false, user: null } as AuthState,
    current: { user: null, auth0User: null, isLoading: true, isError: false, error: null } as CurrentUserState,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => session.auth }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => session.current }));
vi.mock("@/hooks/usePendingMembership", () => ({
    usePendingMembership: () => ({ groupId: null, hasGroup: true, invitations: 0, joinRequests: 0, memberships: 0 }),
}));
vi.mock("next/navigation", () => ({
    usePathname: () => "/solicitudes/11",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

/** La sesión todavía no se sabe: es el instante en que la clienta leía "Entrar / Crear cuenta". */
function unknownSession() {
    session.auth.isLoading = true;
    session.auth.isAuthenticated = false;
    session.auth.user = null;
    session.current = { user: null, auth0User: null, isLoading: true, isError: false, error: null };
}

/** La sesión ya se conoce: cuenta iniciada, dentro de un pedido. */
function signedIn() {
    session.auth.isLoading = false;
    session.auth.isAuthenticated = true;
    session.auth.user = { sub: "auth0|1", email: "camila@example.com", name: "Camila Ramos" };
    session.current = {
        user: { id: 7, userType: "Client", firstName: "Camila" },
        auth0User: session.auth.user,
        isLoading: false,
        isError: false,
        error: null,
    };
}

describe("Cabecera, pie y menú mientras la sesión se carga (ronda 12)", () => {
    beforeEach(unknownSession);

    it("does not introduce itself as anonymous in the header while the session is unknown", () => {
        const { container } = render(<Header />);

        expect(screen.queryByText("Entrar")).toBeNull();
        expect(screen.queryByText("Crear cuenta")).toBeNull();
        // El espacio queda reservado: la acción entra ahí cuando la sesión se conoce, sin mover la fila.
        expect(container.querySelector("span.bg-fondo-2.h-9.w-56")).not.toBeNull();
    });

    it("reveals the action once the session is known, in the space it was holding", () => {
        signedIn();

        const { container } = render(<Header />);

        expect(screen.getByText("Mis pedidos")).toBeInTheDocument();
        expect(screen.queryByText("Entrar")).toBeNull();
        expect(container.querySelector("span.bg-fondo-2.h-9.w-56")).toBeNull();
    });

    it("keeps the footer from introducing itself as anonymous while the session is unknown", () => {
        const { container } = render(<Footer />);

        expect(screen.queryByText("Entrar")).toBeNull();
        expect(screen.queryByText("Crear cuenta")).toBeNull();
        expect(container.querySelector("span.bg-fondo-2.h-5.w-20")).not.toBeNull();
    });

    it("gives the footer its account action back once the session is known", () => {
        signedIn();

        render(<Footer />);

        expect(screen.getByText("Cerrar sesión")).toBeInTheDocument();
        expect(screen.queryByText("Entrar")).toBeNull();
        expect(screen.queryByText("Crear cuenta")).toBeNull();
    });

    it("holds the menu button's slot on a phone instead of leaving a hole in the header", () => {
        const { container } = render(<MobileMenu />);

        // 44 px reservados: cuando la sesión se sabe, el botón entra sin mover la fila.
        expect(container.querySelector("span.size-11")).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Abrir menú" })).toBeNull();
    });
});
