"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Id that the closed-profile notice and the deep link already use: `/dashboard/musician#mi-perfil`. */
export const AVAILABILITY_ANCHOR_ID = "mi-perfil";

/** `#mi-perfil` → "mi-perfil"; a bare "#" or an empty hash asks for no tab. */
export function tabFromHash(hash: string): string {
    return hash.replace(/^#/, "").trim();
}

/** The availability block is the switch inside the profile form, so that is what the link targets. */
export function availabilitySwitch(root: ParentNode | null): HTMLElement | null {
    return root?.querySelector<HTMLElement>('[role="switch"]') ?? null;
}

/** Ring drawn on arrival: `:focus-visible` does not match a focus moved by script after a hash jump. */
function drawRing(el: HTMLElement) {
    el.style.outlineWidth = "2px";
    el.style.outlineStyle = "solid";
    el.style.outlineColor = "var(--acento)";
    el.style.outlineOffset = "2px";
}

function clearRing(el: HTMLElement) {
    el.style.outlineWidth = "";
    el.style.outlineStyle = "";
    el.style.outlineColor = "";
    el.style.outlineOffset = "";
}

/**
 * "Cambiar mi disponibilidad" promete el interruptor, no la pestaña (T36). El perfil llega de la
 * API, así que el interruptor aparece un momento después de abrir: el ancla lo espera, le pone el id
 * del enlace y, cuando la persona llegó por el enlace, lo trae a la vista y lo enfoca con anillo
 * visible. Si abrió la pestaña a mano no mueve el foco: solo deja el bloque anclado.
 */
export function AvailabilityAnchor({ children, focusOnMount = false }: { children: ReactNode; focusOnMount?: boolean }) {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        let focused = false;

        const anchor = (): boolean => {
            const control = availabilitySwitch(host);
            if (!control) return false;
            if (control.id !== AVAILABILITY_ANCHOR_ID) control.id = AVAILABILITY_ANCHOR_ID;
            if (focused || !focusOnMount) return true;
            focused = true;
            control.scrollIntoView?.({ block: "center" });
            control.focus({ preventScroll: true });
            drawRing(control);
            control.addEventListener("blur", () => clearRing(control), { once: true });
            return true;
        };

        if (anchor()) return;
        const observer = new MutationObserver(() => {
            if (anchor()) observer.disconnect();
        });
        observer.observe(host, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [focusOnMount]);

    return <div ref={hostRef}>{children}</div>;
}
