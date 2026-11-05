import { SEARCH_INPUT_ID } from "./MusicianSearch";

/**
 * Moves the viewer to the invite search: the empty states of the team tab send them there instead
 * of leaving a dead end. Respects `prefers-reduced-motion` and leaves the focus on the field.
 */
export function focusMusicianSearch() {
    const input = document.getElementById(SEARCH_INPUT_ID);
    if (!input) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    input.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    input.focus({ preventScroll: true });
}
