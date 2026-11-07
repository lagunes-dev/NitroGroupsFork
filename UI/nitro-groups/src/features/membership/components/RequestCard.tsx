import type { ReactNode } from "react";
import { Ban, ChevronRight, CircleCheck, CircleHelp, CircleX, Clock } from "lucide-react";
import { statusLabel, statusTone, type StatusTone } from "../status";
import type { MembershipStatus } from "../types";
import { Avatar } from "./Avatar";

const TONE_CLASS: Record<StatusTone, string> = { attention: "text-acento", ok: "text-ok", muted: "text-tinta-2" };

const STATUS_ICON = { Pending: Clock, Accepted: CircleCheck, Declined: CircleX, Cancelled: Ban } as const;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

/** The status as an icon plus its text label: the tone never carries the meaning alone. */
export function StatusBadge({ status }: { status: MembershipStatus | null }) {
    const Icon = status ? STATUS_ICON[status] : CircleHelp;
    return (
        <span className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] bg-fondo-3 px-2.5 text-sm font-medium ${TONE_CLASS[statusTone(status)]}`}>
            <Icon aria-hidden className="size-4" />
            {statusLabel(status)}
        </span>
    );
}

interface RequestCardProps {
    /** Display name of the counterpart; the avatar initials come from it. */
    name: string;
    /** Rendered as the title (a plain name or a link). */
    title: ReactNode;
    direction: string;
    createdAt: string;
    status: MembershipStatus | null;
    message: string | null;
    /** The action buttons, or null when the row has none. */
    actions: ReactNode;
}

/**
 * One row of the inbox: avatar and name on the left, status on the right, a single meta line
 * (direction · date) under the name, the optional message, then the actions in one row at the
 * right on desktop and stacked full width on a phone.
 */
export function RequestCard({ name, title, direction, createdAt, status, message, actions }: RequestCardProps) {
    return (
        <li className="superficie grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-4 rounded-[12px] p-4 sm:p-5">
            <Avatar name={name} />
            <div className="min-w-0">
                <p className="truncate font-semibold text-tinta">{title}</p>
                <p className="mt-0.5 truncate text-sm text-tinta-2">
                    {direction} <span aria-hidden>·</span> <time dateTime={createdAt}>{formatDate(createdAt)}</time>
                </p>
            </div>
            <StatusBadge status={status} />
            {message && <p className="col-span-3 max-w-[64ch] text-tinta sm:col-span-2 sm:col-start-2">“{message}”</p>}
            {actions && (
                <div className="col-span-3 flex flex-col gap-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>
            )}
        </li>
    );
}

/** Placeholder rows while the inbox loads: same card, same avatar, same rhythm. */
export function RequestSkeleton({ rows = 2 }: { rows?: number }) {
    return (
        <ul aria-hidden className="flex flex-col gap-4">
            {Array.from({ length: rows }, (_, i) => (
                <li key={i} className="superficie flex items-center gap-4 rounded-[12px] p-4 sm:p-5">
                    <div className="size-12 shrink-0 rounded-full bg-fondo-3 motion-safe:animate-pulse" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 rounded bg-fondo-3 motion-safe:animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-fondo-3 motion-safe:animate-pulse" />
                    </div>
                    <div className="h-7 w-24 rounded-[8px] bg-fondo-3 motion-safe:animate-pulse" />
                </li>
            ))}
        </ul>
    );
}

/** Heading with a count; `collapsible` turns it into a closed-by-default disclosure for the history. */
export function RequestGroup({ id, title, count, collapsible, as: Heading = "h4", children }: { id: string; title: string; count: number; collapsible?: boolean; as?: "h3" | "h4"; children: ReactNode }) {
    const heading = (
        <>
            {title} <span className="ml-1 text-base font-normal text-tinta-2">({count})</span>
        </>
    );
    if (collapsible) {
        return (
            <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[8px] py-1 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
                    <Heading id={id} className="type-heading text-xl text-tinta-2">{heading}</Heading>
                    <ChevronRight aria-hidden className="size-5 text-tinta-2 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                </summary>
                <div className="mt-4">{children}</div>
            </details>
        );
    }
    return (
        <section aria-labelledby={id}>
            <Heading id={id} className="type-heading text-xl">{heading}</Heading>
            <div className="mt-4">{children}</div>
        </section>
    );
}
