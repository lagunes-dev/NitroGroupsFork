"use client";

import { Logo, MobileMenu, PublicNavigation, UserMenu } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
    const { isLoading } = useAuth();

    return (
        <header className="sticky top-0 z-50 border-b border-linea bg-[rgb(10_9_14/0.6)] [backdrop-filter:blur(20px)_saturate(160%)] [-webkit-backdrop-filter:blur(20px)_saturate(160%)]">
            <a
                href="#contenido"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-acento focus:text-acento-ink focus:px-4 focus:py-2"
            >
                Saltar al contenido
            </a>
            <div className="page-frame h-14 flex items-center justify-between gap-6">
                <Logo />
                {/* Nothing while the session loads: a placeholder cannot match both the signed-in and signed-out controls. */}
                {!isLoading && (
                    <>
                        <UserMenu />
                        <PublicNavigation />
                    </>
                )}
                <MobileMenu />
            </div>
        </header>
    );
}
