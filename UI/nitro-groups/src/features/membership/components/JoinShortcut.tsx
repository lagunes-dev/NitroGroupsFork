"use client";

import { Button } from "@/components/ui";
import { showJoinShortcut } from "../join";
import { useJoinOffer } from "../useJoinOffer";

interface JoinShortcutProps {
    groupId: number;
    active: boolean;
    ownerUserId: number;
    signedIn: boolean;
}

/**
 * "Pedir unirse" in the profile header. It shows only where the form below will show (same rule),
 * and takes the viewer to that section: smooth unless they asked for less motion, with focus on
 * the section heading so keyboard and screen reader users land there too.
 */
export function JoinShortcut(props: JoinShortcutProps) {
    const { offer, membersPending } = useJoinOffer(props);
    if (!showJoinShortcut(offer, membersPending)) return null;

    const go = () => {
        const heading = document.getElementById("unirse-titulo");
        if (!heading) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        heading.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        heading.focus({ preventScroll: true });
    };

    return (
        <Button type="button" variant="outline" size="lg" className="h-14 px-7" aria-controls="unirse" onClick={go}>
            Pedir unirse
        </Button>
    );
}
