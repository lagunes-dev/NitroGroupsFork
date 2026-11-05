"use client";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
    NOTICE_ACTION_LABEL,
    isNoticeKind,
    noticeActionName,
    noticeManagerLine,
    noticeSentLabel,
    type GigNoticeKind,
    type NoticePayload,
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
 * The one-tap action of a slot the manager has not loaded yet (S12). It is small and quiet on
 * purpose: the musician is asking for information, not filing a complaint. Once the notice was
 * sent today the button goes away and the slot says so, so it can never be sent twice.
 */
export function NoticeAction({ kind, sent, notifying, onNotify }: NoticeActionProps) {
    if (sent) return <span className="ml-2 text-sm text-tinta-2">{noticeSentLabel(kind)}</span>;

    return (
        <Button
            variant="link"
            className={cn("ml-2 h-auto p-0 text-sm font-normal text-tinta-2 hover:text-acento", notifying && "pointer-events-none opacity-45")}
            aria-label={noticeActionName(kind)}
            aria-disabled={notifying}
            aria-busy={notifying}
            onClick={() => {
                if (!notifying) onNotify(kind);
            }}
        >
            {NOTICE_ACTION_LABEL}
        </Button>
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
