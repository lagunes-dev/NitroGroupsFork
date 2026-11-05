import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { ROUTES } from "@/config/routes";

interface PathProps {
    icon: LucideIcon;
    title: string;
    text: string;
    href: string;
    action: string;
    hint?: string;
}

function Path({ icon: Icon, title, text, href, action, hint }: PathProps) {
    return (
        <li className="superficie flex flex-col rounded-[12px] p-6">
            <Icon aria-hidden className="size-6 text-acento" />
            <h2 className="mt-4 type-heading text-xl">{title}</h2>
            <p className="mt-2 text-tinta">{text}</p>
            {hint && <p className="mt-2 text-sm text-tinta-2">{hint}</p>}
            {/* Same button on both cards (neither path outranks the other), pinned to the bottom. */}
            <div className="mt-auto pt-6">
                <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href={href}>{action}</Link>
                </Button>
            </div>
        </li>
    );
}

/**
 * Panel of a musician who manages no group (they may still be a Member of one): two equal paths, create one or join an existing one.
 * The invitations tab stays right below it (rendered by the dashboard page).
 */
export function NoGroupPaths() {
    return (
        <section aria-labelledby="sin-grupo" className="pt-14">
            <h1 id="sin-grupo" className="titulo">Aún no gestionas un grupo</h1>
            <p className="mt-3 max-w-[56ch] text-tinta-2">Crea el tuyo o pide unirte a uno existente. Las invitaciones que recibas aparecen abajo, en Invitaciones.</p>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
                <Path
                    icon={Sparkles}
                    title="Crear mi grupo"
                    text="Publica el perfil de tu grupo y empieza a recibir pedidos de fecha."
                    href={ROUTES.AUTH.ONBOARDING}
                    action="Crear mi grupo"
                />
                <Path
                    icon={Search}
                    title="Unirme a un grupo"
                    text="Busca un grupo existente y pide formar parte."
                    hint="Abre el perfil del grupo y pulsa “Pedir unirse”."
                    href={ROUTES.GROUPS.SEARCH}
                    action="Buscar grupos"
                />
            </ul>
        </section>
    );
}
