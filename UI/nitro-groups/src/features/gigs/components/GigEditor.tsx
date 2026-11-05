"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Textarea, TimeSelect } from "@/components/ui";
import { cn } from "@/lib/utils";
import { groupGigsKey } from "../gigs.queries";
import { gigsService } from "../gigs.service";
import {
    buildDetailsBody,
    buildPayBody,
    initialLogisticsForm,
    setlistCounter,
    validateLogistics,
    type LogisticsErrors,
    type LogisticsForm,
} from "../gigLogistics";
import type { GroupGigPayload } from "../types";

interface GigEditorProps {
    row: GroupGigPayload;
    groupId: number;
    /** Stable prefix for the field ids: two open rows never share one. */
    idPrefix: string;
    onSaved: () => void;
    onCancel: () => void;
}

const NO_ERRORS: LogisticsErrors = { pay: {} };

/**
 * Inline "Editar toque" panel: call time, setlist, deposit and what each musician is paid. Two calls
 * (details, then pay) because the API keeps them apart; a failure in either shows one retry that sends
 * both again, which is safe because both replace what they hold.
 */
export function GigEditor({ row, groupId, idPrefix, onSaved, onCancel }: GigEditorProps) {
    const queryClient = useQueryClient();
    const formRef = useRef<HTMLFormElement>(null);
    const [form, setForm] = useState<LogisticsForm>(() => initialLogisticsForm(row));
    const [errors, setErrors] = useState<LogisticsErrors>(NO_ERRORS);
    const attendees = (row.attendees ?? []).filter((a) => a.userId !== null && a.userId !== undefined && Number.isInteger(Number(a.userId)));
    const rowId = Number(row.id);

    const save = useMutation({
        mutationFn: async (input: LogisticsForm) => {
            await gigsService.saveDetails(groupId, rowId, buildDetailsBody(input));
            await gigsService.savePay(groupId, rowId, buildPayBody(input.pay));
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: groupGigsKey(groupId) });
            onSaved();
        },
    });

    const submit = () => {
        if (save.isPending) return;
        const result = validateLogistics(form);
        setErrors(result.errors);
        if (!result.valid) {
            // The errors render on the next pass: focus the first invalid control once it is marked.
            setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
            return;
        }
        save.mutate(form);
    };

    const setPay = (userId: string, value: string) => setForm((f) => ({ ...f, pay: { ...f.pay, [userId]: value } }));

    return (
        <form
            ref={formRef}
            noValidate
            aria-label="Editar toque"
            className="superficie mt-4 flex flex-col gap-6 rounded-[12px] p-4 sm:p-5 md:col-span-12"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <div className="grid gap-6 md:grid-cols-2">
                <TimeSelect
                    id={`${idPrefix}-call`}
                    label="Hora de llegada"
                    value={form.callTime}
                    onValueChange={(callTime) => setForm((f) => ({ ...f, callTime }))}
                    helperText="Los músicos la ven junto a la hora de inicio."
                />

                <div className="flex flex-col gap-3">
                    <Input
                        id={`${idPrefix}-deposit`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        label="Anticipo (MXN)"
                        value={form.depositAmount}
                        error={errors.depositAmount}
                        helperText="Solo se registra: la app no cobra."
                        onChange={(event) => setForm((f) => ({ ...f, depositAmount: event.target.value }))}
                    />
                    <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 text-tinta">
                        <input
                            type="checkbox"
                            className="size-6 accent-acento"
                            checked={form.depositReceived}
                            onChange={(event) => setForm((f) => ({ ...f, depositReceived: event.target.checked }))}
                        />
                        Anticipo recibido
                    </label>
                </div>
            </div>

            <Textarea
                id={`${idPrefix}-setlist`}
                label="Setlist"
                rows={6}
                value={form.setlist}
                error={errors.setlist}
                helperText={`${setlistCounter(form.setlist)} · Los músicos lo ven en su agenda; el cliente no.`}
                onChange={(event) => setForm((f) => ({ ...f, setlist: event.target.value }))}
            />

            {attendees.length > 0 && (
                <div>
                    <table className="w-full text-left">
                        <caption className="pb-2 text-left text-sm font-medium text-tinta">
                            Pago a cada músico <span className="font-normal text-tinta-2">(solo informativo: cada quien ve únicamente el suyo)</span>
                        </caption>
                        <thead className="sr-only">
                            <tr>
                                <th scope="col">Músico</th>
                                <th scope="col">Pago (MXN)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendees.map((attendee) => {
                                const key = String(Number(attendee.userId));
                                const name = (attendee.fullName ?? "").trim() || "músico sin nombre";
                                return (
                                    <tr key={key} className="align-top [&+&]:shadow-[inset_0_1px_0_var(--fondo-3)]">
                                        <th scope="row" className="py-3 pr-4 font-normal text-tinta sm:w-1/2">
                                            <span className="flex min-h-12 items-center">{name}</span>
                                        </th>
                                        <td className="py-3">
                                            <Input
                                                id={`${idPrefix}-pay-${key}`}
                                                type="number"
                                                inputMode="decimal"
                                                min={0}
                                                step="0.01"
                                                placeholder="Sin pago"
                                                aria-label={`Pago a ${name}`}
                                                value={form.pay[key] ?? ""}
                                                error={errors.pay[key]}
                                                onChange={(event) => setPay(key, event.target.value)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {save.isError && (
                <p role="alert" className="text-sm text-error">
                    No pudimos guardar los cambios del toque.{" "}
                    <Button type="button" variant="link" className="h-auto text-sm text-error" onClick={submit}>
                        Reintentar
                    </Button>
                </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="submit"
                    className={cn("h-11 sm:h-10", save.isPending && "pointer-events-none opacity-45")}
                    aria-disabled={save.isPending}
                    aria-busy={save.isPending}
                >
                    {save.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
                <Button type="button" variant="outline" className="h-11 sm:h-10" onClick={onCancel}>
                    Cancelar
                </Button>
            </div>
        </form>
    );
}
