"use client";

import Link from "next/link";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/hooks/useAuth";
import LogoutButton from "@/components/auth/LogoutButton";
import { Logo } from "./Logo";

/** Pie sobrio: la marca, tres columnas cortas y una línea legal. Sabe si hay sesión. */
export default function Footer() {
    const { isAuthenticated } = useAuth();
    const year = new Date().getFullYear();
    const link = "no-underline text-tinta-2 hover:text-tinta transition-colors";
    return (
        <footer className="mt-[var(--section-gap)] border-t border-linea">
            <div className="page-frame py-14 grid gap-10 md:grid-cols-12 text-[0.9375rem]">
                <div className="md:col-span-5">
                    <Logo />
                    <p className="mt-3 max-w-[34ch] text-tinta-2">Música en vivo para bodas, XV años y eventos en México.</p>
                </div>
                <div className="md:col-span-2">
                    <p className="text-tinta">Contratar</p>
                    <ul className="mt-3 space-y-2">
                        <li><Link href={ROUTES.GROUPS.SEARCH} className={link}>Explorar grupos</Link></li>
                        {isAuthenticated && <li><Link href={ROUTES.DASHBOARD.ROOT} className={link}>Mis pedidos</Link></li>}
                    </ul>
                </div>
                <div className="md:col-span-2">
                    <p className="text-tinta">Grupos</p>
                    <ul className="mt-3 space-y-2">
                        <li><Link href={ROUTES.AUTH.SIGNUP_MUSICIAN} className={link}>Publicar mi grupo</Link></li>
                        {isAuthenticated && <li><Link href={ROUTES.DASHBOARD.ROOT} className={link}>Mi panel</Link></li>}
                    </ul>
                </div>
                <div className="md:col-span-3">
                    <p className="text-tinta">Cuenta</p>
                    <ul className="mt-3 space-y-2">
                        {isAuthenticated ? (
                            <li><LogoutButton /></li>
                        ) : (
                            <>
                                <li><Link href={ROUTES.AUTH.LOGIN} className={link}>Entrar</Link></li>
                                <li><Link href={ROUTES.AUTH.SIGNUP} className={link}>Crear cuenta</Link></li>
                            </>
                        )}
                    </ul>
                </div>
            </div>
            <div className="page-frame pb-10 text-[0.8125rem] text-tinta-2">© {year} NitroGroups</div>
        </footer>
    );
}
