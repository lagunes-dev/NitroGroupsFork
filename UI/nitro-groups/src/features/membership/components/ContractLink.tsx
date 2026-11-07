"use client";

import Link from "next/link";
import { useJoinOffer } from "../useJoinOffer";

interface ContractLinkProps {
    groupId: number;
    slug?: string | null;
    active: boolean;
    ownerUserId: number;
    signedIn: boolean;
    href: string;
    label: string;
}

/**
 * "Pedir una fecha" for clients. A member of the group is not a client here: contracting your own
 * band makes no sense, so the link disappears for them (and while memberships load we render nothing
 * rather than flash an offer the viewer may not use).
 */
export function ContractLink({ groupId, slug, active, ownerUserId, signedIn, href, label }: ContractLinkProps) {
    const { isMember } = useJoinOffer({ groupId, slug, active, ownerUserId, signedIn });
    if (isMember) return null;
    return (
        <Link
            href={href}
            className="inline-flex h-14 items-center justify-center px-7 bg-acento text-acento-ink rounded-lg font-semibold no-underline hover:bg-acento-press transition-colors"
        >
            {label}
        </Link>
    );
}
