"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import Loader from "@/components/ui/Loader";
import { safeReturnTo } from "@/lib/safeRedirect";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "Error al iniciar sesión");
                setIsLoading(false);
                return;
            }

            // Login successful - redirect to the current default dashboard flow.
            // Solo rutas internas: evita un open redirect con ?returnTo=https://...
            window.location.href = safeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
        } catch (err) {
            console.error("Login error:", err);
            setError("Error al conectar con el servidor");
            setIsLoading(false);
        }
    };

    return (
        <div className="page-frame min-h-[calc(100vh-4rem)] grid md:grid-cols-12 gap-x-8 gap-y-10 content-center py-16">
            <div className="md:col-span-5 md:col-start-2 w-full max-w-md space-y-8">
                {/* Header */}
                <div className="space-y-3">
                    <h1 className="titulo">
                        Entrar
                    </h1>
                    <p className="text-tinta-2">
                        Inicia sesión para continuar con NitroGroups
                    </p>
                </div>

                {/* Login Form */}
                <div className="space-y-6">
                    <div aria-live="polite">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Correo electrónico"
                            type="email"
                            autoComplete="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            icon={<Mail aria-hidden />}
                        />

                        <Input
                            label="Contraseña"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            icon={<Lock aria-hidden />}
                        />

                        <div className="flex items-center justify-between gap-4 text-sm">
                            <label className="flex min-h-11 items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="size-4 accent-acento"
                                />
                                <span className="text-tinta-2">Recordarme</span>
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-acento hover:underline"
                            >
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader inline />
                                    <span>Iniciando sesión...</span>
                                </>
                            ) : (
                                "Iniciar sesión"
                            )}
                        </Button>
                    </form>

                    {/* Divider */}
                </div>

                {/* Sign Up Link */}
                <p className="text-sm text-tinta-2">
                    ¿No tienes una cuenta?{" "}
                    <Link href="/signup" className="text-acento font-medium hover:underline">
                        Regístrate gratis
                    </Link>
                </p>
            </div>
            <aside className="hidden md:block md:col-span-4 md:col-start-8">
                <p className="border-l border-linea pl-6 text-base leading-relaxed text-tinta-2 max-w-[34ch]">
                    Tus solicitudes, tus fechas y cada conversación con los grupos, en un solo lugar.
                </p>
            </aside>
        </div>
    );
}
