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
 */
export function CollapsibleProfile({ title, children }: { title: string; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();

    return (
        <div>
            <div className="mt-8 flex items-center justify-between gap-4 md:hidden">
                <p className="type-heading min-w-0 break-words text-xl text-tinta">{title}</p>
                <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen((previous) => !previous)}
                >
                    {open ? "Ocultar perfil" : "Ver perfil"}
                </Button>
            </div>
            <div id={panelId} className={open ? "block" : "hidden md:block"}>
                {children}
            </div>
        </div>
    );
}
