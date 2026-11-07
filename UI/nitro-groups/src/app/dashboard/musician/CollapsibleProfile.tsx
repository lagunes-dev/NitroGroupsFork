"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/**
 * T42: a 390 px el perfil del grupo ocupa una pantalla entera y la bandeja arranca debajo, así que
 * el manager abría el panel y no veía su trabajo pendiente. Debajo de `md` el perfil queda plegado
 * detrás del nombre y de un botón, con la tarjeta entera a una pulsación; de `md` para arriba no
 * cambia nada: el resumen no se ofrece y el perfil se ve siempre.
 *
 * El resumen es un `<p>` y no un `<h1>`: la tarjeta de adentro ya trae el título de la página.
 *
 * Ronda 9: el botón decía "Ver perfil" y no decía de quién era el perfil que abría, en un panel que ya
 * tiene una pestaña "Perfil" del músico. La entrada se llama por lo que es: el perfil del grupo.
 *
 * Ronda 10: leer el perfil y editarlo son dos acciones distintas, y las dos viven en un toque. La
 * entrada sigue leyendo; `editAction` añade al lado una acción que abre el formulario, con un nombre que
 * lo dice.
 *
 * Ronda 10 (destructive close): while the editor is open the panel shows the group form, not the profile
 * card, so the entry names what is really on screen. And closing it must not throw the draft away
 * silently: `editing` turns on the confirmation and `onDiscard` is the only path that discards.
 */
export function CollapsibleProfile({ title, children, editAction, editing = false, onDiscard }: {
    title: string;
    children: ReactNode;
    /** Acción opcional junto a la entrada. Hoy: abrir el formulario del perfil del grupo. */
    editAction?: { label: string; onClick: () => void };
    /** The panel currently shows the group profile form instead of the profile card. */
    editing?: boolean;
    /** Called only after the manager confirms closing the editor without saving. */
    onDiscard?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [confirmingClose, setConfirmingClose] = useState(false);
    const panelId = useId();
    const dialogTitleId = useId();
    const dialogDetailId = useId();
    const keepEditingRef = useRef<HTMLButtonElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);

    // The confirmation is the only thing to answer: put the keyboard on the safe answer.
    useEffect(() => {
        if (confirmingClose) keepEditingRef.current?.focus();
    }, [confirmingClose]);

    const toggle = () => {
        if (!open) {
            setOpen(true);
            return;
        }
        // Closing now would throw away the draft: ask before hiding anything.
        if (editing) {
            setConfirmingClose(true);
            return;
        }
        setOpen(false);
    };

    const discardAndClose = () => {
        setConfirmingClose(false);
        setOpen(false);
        onDiscard?.();
    };

    // Staying puts the keyboard back where the question came from, not on a button that no longer exists.
    const keepEditing = () => {
        setConfirmingClose(false);
        toggleRef.current?.focus();
    };

    // The name describes what is expanded on screen: the form while editing, the card otherwise.
    const entryLabel = open
        ? (editing ? "Ocultar el formulario del grupo" : "Ocultar perfil del grupo")
        : (editing ? "Formulario del grupo" : "Perfil del grupo");

    return (
        <div>
            {/*
                Dos acciones de 44 px no entran en el mismo renglón que el nombre a 390 px, así que el
                renglón envuelve: el título arriba y las acciones debajo, sin recortar ninguna.
            */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 md:hidden">
                <p className="type-heading min-w-0 break-words text-xl text-tinta">{title}</p>
                <Button
                    ref={toggleRef}
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={toggle}
                >
                    {entryLabel}
                </Button>
                {editAction && (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="min-h-11 shrink-0"
                        onClick={() => {
                            // Editar implica ver lo que se edita: el panel se abre y pide el formulario.
                            setOpen(true);
                            editAction.onClick();
                        }}
                    >
                        {editAction.label}
                    </Button>
                )}
            </div>
            <div id={panelId} className={open ? "block" : "hidden md:block"}>
                {children}
            </div>

            {confirmingClose && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-fondo/85 p-4"
                    role="presentation"
                    onClick={keepEditing}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={dialogTitleId}
                        aria-describedby={dialogDetailId}
                        className="w-full max-w-md bg-fondo-2 p-6 text-tinta shadow-[0_24px_64px_-16px_var(--fondo)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id={dialogTitleId} className="type-heading text-2xl">
                            ¿Cerrar el formulario sin guardar?
                        </h2>
                        <p id={dialogDetailId} className="mt-3 text-tinta-2">
                            Lo que escribiste no se guarda. El perfil del grupo queda como estaba.
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                                ref={keepEditingRef}
                                type="button"
                                variant="ghost"
                                className="min-h-11"
                                onClick={keepEditing}
                            >
                                Seguir editando
                            </Button>
                            <Button type="button" className="min-h-11" onClick={discardAndClose}>
                                Cerrar sin guardar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
