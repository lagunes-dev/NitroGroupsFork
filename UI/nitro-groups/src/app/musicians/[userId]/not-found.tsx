import Link from "next/link";
import { ROUTES } from "@/config/routes";

/**
 * 404 del perfil de un músico: el id no existe o la persona no es músico. Dice qué pasó y
 * ofrece la salida útil (seguir explorando), en lugar de una pantalla en blanco.
 */
export default function MusicianNotFound() {
    return (
        <section className="page-frame max-w-4xl py-24 md:py-32">
            <h1 className="titulo">Este perfil no existe</h1>
            <p className="mt-6 max-w-[52ch] text-lg text-tinta">
                Puede que el enlace esté incompleto o que esta persona todavía no tenga perfil de músico en NitroGroups.
            </p>
            <Link
                href={ROUTES.GROUPS.SEARCH}
                className="mt-10 inline-flex h-12 items-center rounded-[8px] bg-acento px-6 font-[family-name:var(--font-display)] font-semibold text-acento-ink no-underline transition-colors duration-300 ease-[var(--ease-out)] hover:bg-acento-press"
            >
                Explorar grupos
            </Link>
        </section>
    );
}
