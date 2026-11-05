// Shared setup for component tests. The suite defaults to the node environment, so this file must stay
// harmless there: the DOM-only parts are guarded.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

afterEach(async () => {
    if (typeof document === "undefined") return;
    const { cleanup } = await import("@testing-library/react");
    cleanup();
});
