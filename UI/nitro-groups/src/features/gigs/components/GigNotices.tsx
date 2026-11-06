"use client";

import { useId } from "react";
import { BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
    NOTICE_LIST_LABEL,
    isNoticeKind,
    noticeActionName,
    noticeManagerLine,
    noticeSentLabel,
    type GigNoticeKind,
    type NoticePayload,
    type NoticeSlot,
} from "../notices";

interface NoticeActionProps {
    kind: GigNoticeKind;
    /** True when the musician already told the group today: the row says so and offers nothing. */
    sent: boolean;
    /** True while this very notice is on its way. */
    notifying: boolean;
    onNotify: (kind: GigNoticeKind) => void;
}

/**
 * The one-tap action of a slot the manager has not loaded yet (S12). It reads as an action, not as
 * part of the sentence above (ronda 6, Mateo y Miguel): its own 44 px row, a surface with a border,
 * an icon and the slot named in words. Once the notice was sent today the row says so and offers
 * nothing, so it can never be sent twice.
 */
export function NoticeAction({ kind, sent, notifying, onNotify }: NoticeActionProps) {
    const row = "flex min-h-11 w-full items-center justify-start gap-2 rounded-[8px] px-3 text-sm sm:w-fit";

    if (sent) {
        return (
            <span className={cn(row, "border border-linea bg-fondo-2 font-normal text-tinta-2")}>
                <Check aria-hidden className="size-4 shrink-0" />
                {noticeSentLabel(kind)}
            </span>
        );
    }

    return (
        <Button
            variant="outline"
            className={cn(row, "font-medium text-tinta", notifying && "pointer-events-none opacity-45")}
            aria-label={noticeActionName(kind)}
            aria-disabled={notifying}
            aria-busy={notifying}
            onClick={() => {
                if (!notifying) onNotify(kind);
            }}
        >
            <BellRing aria-hidden className="size-4 shrink-0" />
            {noticeActionName(kind)}
        </Button>
    );
}

/**
 * The notices of one gig, in their own block under the logistics text: one row per slot that is
 * still missing. Each row names its slot, so three actions in a column never read the same.
 */
export function NoticeActions({
    slots,
    notifying,
    onNotify,
}: {
    slots: readonly NoticeSlot[];
    notifying: GigNoticeKind | null;
    onNotify: (kind: GigNoticeKind) => void;
}) {
    const headingId = useId();
    if (slots.length === 0) return null;

    // Own block: a rule, a visible heading and extra air above, so a thumb aimed at "Confirmo" or
    // "No puedo" never lands on a notice (T46, 390 px).
    return (
        <div className="mt-3 border-t border-linea pt-4">
            <p id={headingId} className="text-sm font-semibold text-tinta">
                {NOTICE_LIST_LABEL}
            </p>
            <ul aria-labelledby={headingId} className="mt-3 flex flex-col gap-2">
                {slots.map((slot) => (
                    <li key={slot.kind}>
                        <NoticeAction kind={slot.kind} sent={slot.sent} notifying={notifying === slot.kind} onNotify={onNotify} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * What a gig received, as the manager's agenda lists it under the row (S12): "Mateo avisa que falta
 * el pago". It draws nothing when there are no notices, and it ignores a kind the contract does not
 * know instead of printing it.
 */
export function NoticeLines({ notices }: { notices: readonly NoticePayload[] | null | undefined }) {
    const lines = (notices ?? [])
        .filter((notice): notice is NoticePayload & { kind: GigNoticeKind } => isNoticeKind(notice.kind))
        .map((notice) => ({ key: String(notice.id ?? `${notice.userId}-${notice.kind}`), text: noticeManagerLine(notice.fullName, notice.kind) }));

    if (lines.length === 0) return null;

    return (
        <ul className="mt-1 flex flex-col text-sm text-tinta-2">
            {lines.map((line) => (
                <li key={line.key}>{line.text}</li>
            ))}
        </ul>
    );
}
