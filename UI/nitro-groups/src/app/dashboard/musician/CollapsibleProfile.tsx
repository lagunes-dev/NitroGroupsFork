"use client";

import { useId, useState, type ReactNode } from "react";
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
 */
export function CollapsibleProfile({ title, children, editAction }: {
    title: string;
    children: ReactNode;
    /** Acción opcional junto a la entrada. Hoy: abrir el formulario del perfil del grupo. */
    editAction?: { label: string; onClick: () => void };
}) {
    const [open, setOpen] = useState(false);
    const panelId = useId();

    return (
        <div>
            {/*
                Dos acciones de 44 px no entran en el mismo renglón que el nombre a 390 px, así que el
                renglón envuelve: el título arriba y las acciones debajo, sin recortar ninguna.
            */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 md:hidden">
                <p className="type-heading min-w-0 break-words text-xl text-tinta">{title}</p>
                <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 shrink-0"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen((previous) => !previous)}
                >
                    {open ? "Ocultar perfil del grupo" : "Perfil del grupo"}
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
        </div>
    );
}
