"use client";

import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { isUnanswered, pastAppearance, type AttendanceTone } from "../attendance";
import type { GigNoticeKind } from "../notices";
import type { GigAnswer } from "../types";
import {
    ANSWER_SAVES_LINE,
    confirmButtonName,
    declineButtonName,
    scheduleLabel,
    CALL_TIME_PENDING,
    CONFIRMED_NEXT_STEP,
    DECLINED_NEXT_STEP,
    PAST_GIG_LINE,
    PAY_PENDING,
    SETLIST_PENDING,
    type GigView,
} from "../viewModel";
import { NoticeActions } from "./GigNotices";

const CHIP_VARIANT: Record<AttendanceTone, "ok" | "destructive" | "secondary"> = {
    ok: "ok",
    error: "destructive",
    muted: "secondary",
};

/** The caller's answer as a chip: an icon and a word, so the tone is never the only cue. */
export function AttendanceChip({ attendance }: { attendance: GigView["attendance"] }) {
    const Icon = attendance.icon;
    return (
        <Badge variant={CHIP_VARIANT[attendance.tone]} className="w-fit">
            <Icon aria-hidden className="size-4" />
            {attendance.text}
        </Badge>
    );
}

interface GigCardProps {
    gig: GigView;
    /** True when the date is already behind us: the row asks for nothing and offers no logistics. */
    past?: boolean;
    /** True while this row's answer is being saved: both buttons stay disabled until it lands. */
    saving: boolean;
    /** True when the last answer for this row failed: the row offers the same answer again. */
    failed: boolean;
    onAnswer: (status: GigAnswer) => void;
    onRetry: () => void;
    /** The notice of this row that is on its way to the group, if any. */
    notifying: GigNoticeKind | null;
    /** True when the last notice of this row did not land. */
    notifyFailed: boolean;
    onNotify: (kind: GigNoticeKind) => void;
}

/**
 * One gig of the musician's agenda: the date, the group (linked to its public profile), the place and
 * the schedule, then the answer. The buttons are named with the group and the date so two rows never
 * sound alike, and they stay mounted after answering, so focus is never lost.
 *
 * A gig whose date already passed asks nothing: it says so, and neither the answer buttons nor the
 * logistics notices are drawn (ronda 6, Mateo). A gig the musician declined keeps the answer buttons
 * but says in one line what happens next.
 */
export function GigCard({ gig, past = false, saving, failed, onAnswer, onRetry, notifying, notifyFailed, onNotify }: GigCardProps) {
    const answered = gig.attendance.status;
    // While saving, both buttons are inert for the pointer and for the keyboard, but they are NOT
    // `disabled`: disabling the element that has focus throws focus back to the page in some browsers.
    const answerButton = "h-11 flex-1 px-4 sm:h-9 sm:flex-initial";
    const guard = (status: GigAnswer) => () => {
        if (!saving) onAnswer(status);
    };
    const declined = answered === "Declined";
    // Un toque rechazado no pide logística (no vas) y uno pasado no pide nada de nada.
    const skipped = declined || past;
    const slots = skipped ? [] : gig.notices;
    return (
        <li className="superficie flex flex-col gap-4 rounded-[12px] p-4 sm:p-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                    <p className="type-heading text-xl tabular first-letter:uppercase">{gig.dateLabel}</p>
                    <p className="mt-1 font-semibold text-tinta">
                        {gig.group.href ? (
                            <Link href={gig.group.href} className="text-tinta underline-offset-4 hover:text-acento hover:underline">
                                {gig.group.name}
                            </Link>
                        ) : (
                            gig.group.name
                        )}
                        {gig.roleLabel && <span className="ml-2 text-sm font-normal text-tinta-2">· {gig.roleLabel}</span>}
                    </p>
                    <p className="text-tinta-2">{gig.placeLabel}</p>
                    <p className="tabular text-tinta-2">
                        {scheduleLabel(gig)}
                        {gig.callTimeLabel ? (
                            <span> · {gig.callTimeLabel}</span>
                        ) : (
                            !skipped && <span className="italic"> · {CALL_TIME_PENDING}</span>
                        )}
                    </p>
                    {gig.payLabel ? (
                        <p className="tabular text-tinta-2">
                            {gig.payLabel}
                            {/* T48: the manager records the payment; the musician can finally tell. */}
                            {gig.paidLabel && <span> · {gig.paidLabel}</span>}
                        </p>
                    ) : (
                        !skipped && <p className="tabular text-tinta-2 italic">{PAY_PENDING}</p>
                    )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <AttendanceChip attendance={past ? pastAppearance(gig.attendance) : gig.attendance} />
                    {past ? (
                        <p className="text-sm text-tinta-2">{PAST_GIG_LINE}</p>
                    ) : (
                        <div className="flex gap-4 sm:gap-2">
                            <Button
                                size="sm"
                                className={cn(answerButton, saving && "pointer-events-none opacity-45")}
                                variant={answered === "Confirmed" ? "default" : "outline"}
                                aria-pressed={answered === "Confirmed"}
                                aria-disabled={saving}
                                aria-busy={saving}
                                aria-label={confirmButtonName(gig)}
                                onClick={guard("Confirmed")}
                            >
                                Confirmo
                            </Button>
                            <Button
                                size="sm"
                                className={cn(answerButton, saving && "pointer-events-none opacity-45")}
                                variant={answered === "Declined" ? "destructive" : "outline"}
                                aria-pressed={answered === "Declined"}
                                aria-disabled={saving}
                                aria-busy={saving}
                                aria-label={declineButtonName(gig)}
                                onClick={guard("Declined")}
                            >
                                No puedo
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {!past && isUnanswered(gig.attendance) && (
                <p className="text-sm text-tinta-2">{ANSWER_SAVES_LINE}</p>
            )}
            {!past && declined && <p className="text-sm text-tinta-2">{DECLINED_NEXT_STEP}</p>}
            {!past && answered === "Confirmed" && <p className="text-sm text-tinta-2">{CONFIRMED_NEXT_STEP}</p>}

            {/* Los avisos van en su propio bloque: cada uno es una acción con altura de 44 px. */}
            <NoticeActions slots={slots} notifying={notifying} onNotify={onNotify} />

            {gig.setlist ? (
                <details>
                    <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-medium text-acento">
                        Ver setlist
                    </summary>
                    <p className="whitespace-pre-line pb-2 text-tinta">{gig.setlist}</p>
                </details>
            ) : (
                !skipped && <p className="text-sm text-tinta-2 italic">{SETLIST_PENDING}</p>
            )}

            {!past && notifyFailed && (
                <p role="alert" className="text-sm text-error">
                    No pudimos enviar el aviso. Intenta de nuevo.
                </p>
            )}

            {!past && failed && (
                <p role="alert" className="text-sm text-error">
                    No pudimos guardar tu respuesta.{" "}
                    <Button variant="link" className="h-auto text-sm text-error" onClick={onRetry}>
                        Reintentar
                    </Button>
                </p>
            )}
        </li>
    );
}

/** Card shaped placeholder: the agenda keeps its rhythm while the list loads. */
export function GigCardSkeleton({ rows = 2 }: { rows?: number }) {
    return (
        <ul aria-hidden className="flex flex-col gap-4">
            {Array.from({ length: rows }, (_, index) => (
                <li key={index} className="superficie flex flex-col gap-4 rounded-[12px] p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-2/5 rounded bg-fondo-3 motion-safe:animate-pulse" />
                        <div className="h-4 w-1/3 rounded bg-fondo-3 motion-safe:animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-fondo-3 motion-safe:animate-pulse" />
                    </div>
                    <div className="h-11 w-full rounded-[8px] bg-fondo-3 motion-safe:animate-pulse sm:h-9 sm:w-48" />
                </li>
            ))}
        </ul>
    );
}
