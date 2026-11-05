import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Photo } from "@/components/ui/Photo";
import type { DirectoryCard } from "../directory";
import { musicianProfileHref } from "../links";

/**
 * One musician in the directory. `actions` is a slot for whatever the page decides to offer next
 * to the card (the invite button): features never import each other, so the page composes them.
 */
export function MusicianCard({ card, actions }: { card: DirectoryCard; actions?: ReactNode }) {
    const facts = [card.city, card.years].filter(Boolean) as string[];

    return (
        <li className="superficie flex flex-col gap-4 rounded-[12px] p-5">
            <div className="flex min-w-0 items-center gap-4">
                <Photo src={card.photoUrl} alt={`Foto de ${card.name}`} fallbackTitle={card.name} className="size-14 shrink-0 rounded-full" />
                <div className="min-w-0">
                    <Link
                        href={musicianProfileHref(card.userId)}
                        className="inline-flex min-h-11 items-center font-semibold text-tinta no-underline hover:text-acento"
                    >
                        <span className="truncate">{card.name}</span>
                    </Link>
                    {card.headline && <p className="line-clamp-2 text-sm text-tinta-2">{card.headline}</p>}
                </div>
            </div>

            {card.instruments.length > 0 && (
                <ul aria-label={`Instrumentos de ${card.name}`} className="flex flex-wrap gap-2">
                    {card.instruments.map((instrument) => (
                        <li key={instrument}><Badge variant="secondary">{instrument}</Badge></li>
                    ))}
                </ul>
            )}

            {facts.length > 0 && <p className="text-sm text-tinta-2">{facts.join(" · ")}</p>}

            {actions && <div className="mt-auto empty:hidden">{actions}</div>}
        </li>
    );
}
