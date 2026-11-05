import { pendingTabLabel } from "@/features/membership/counts";

/**
 * Pending-count pill after a menu label. The live region exists from the first render and its
 * content appears later, so a count that arrives after load is announced politely. The number is
 * also spelled out for screen readers; the pill itself is hidden from them.
 */
export function NavCount({ count }: { count: number }) {
    return (
        <span aria-live="polite">
            {count > 0 && (
                <>
                    <span aria-hidden className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-acento px-1.5 text-xs font-semibold tabular text-acento-ink">
                        {count}
                    </span>
                    <span className="sr-only">{pendingTabLabel("", count)}</span>
                </>
            )}
        </span>
    );
}
