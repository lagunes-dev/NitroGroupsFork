"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/config/routes";
import { LogoutButton } from "@/components/auth";
import { UserTypeEnum } from "@/features/groups/types/User";
import { usePendingMembership } from "@/hooks/usePendingMembership";
import { PUBLIC_LINKS, dashboardEntries, directoryEntry } from "./navigation";
import { NavCount } from "./NavCount";

export function MobileMenu() {
    const { user, auth0User, isLoading } = useCurrentUser();
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const pending = usePendingMembership();

    // Cerrar al navegar y con Escape.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);
    const [lastPath, setLastPath] = useState(pathname);
    if (pathname !== lastPath) {
        setLastPath(pathname);
        setOpen(false);
    }

    if (isLoading) return null;

    const directory = directoryEntry(pending.hasGroup);
    const entries = dashboardEntries(user?.userType === UserTypeEnum.Musician, pending);
    const linkClass = "block py-3 text-2xl type-heading text-tinta no-underline";

    return (
        <div className="md:hidden">
            <button
                type="button"
                className="size-11 grid place-items-center -mr-2"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="menu-movil"
                aria-label={open ? "Cerrar menú" : "Abrir menú"}
            >
                {open ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>

            {/* Portal: dentro de la cabecera con desenfoque, position:fixed se resuelve contra ella y el panel queda de 48 px. */}
            {open && createPortal(
                <div id="menu-movil" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }} className="fixed inset-x-0 top-14 bottom-0 z-40 bg-fondo px-[var(--gutter)] py-6 overflow-y-auto">
                    <nav aria-label="Principal">
                        <Link href={ROUTES.GROUPS.SEARCH} className={linkClass}>Explorar grupos</Link>
                        {auth0User && directory && <Link href={directory.href} className={linkClass}>{directory.label}</Link>}
                        {auth0User ? (
                            entries.map((e) => (
                                <Link key={e.label} href={e.href} className={linkClass}>{e.label}<NavCount count={e.count} /></Link>
                            ))
                        ) : (
                            PUBLIC_LINKS.filter((l) => l.href !== ROUTES.GROUPS.SEARCH).map((l) => (
                                <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
                            ))
                        )}
                    </nav>
                    <div className="mt-8 flex flex-col gap-3">
                        {auth0User ? (
                            <LogoutButton />
                        ) : (
                            <>
                                <Button asChild size="lg"><Link href={ROUTES.AUTH.SIGNUP}>Crear cuenta</Link></Button>
                                <Button asChild size="lg" variant="secondary"><Link href={ROUTES.AUTH.LOGIN}>Entrar</Link></Button>
                            </>
                        )}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
