"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass, floatingPanelClass } from "./field";

interface CountryCode {
    code: string;
    name: string;
    dial: string;
}

// Sin banderas emoji: el código ISO y la lada se leen igual en cualquier sistema.
const COUNTRY_CODES: CountryCode[] = [
    { code: "MX", name: "México", dial: "+52" },
    { code: "US", name: "Estados Unidos", dial: "+1" },
    { code: "CO", name: "Colombia", dial: "+57" },
    { code: "AR", name: "Argentina", dial: "+54" },
    { code: "ES", name: "España", dial: "+34" },
    { code: "CL", name: "Chile", dial: "+56" },
    { code: "PE", name: "Perú", dial: "+51" },
    { code: "EC", name: "Ecuador", dial: "+593" },
    { code: "VE", name: "Venezuela", dial: "+58" },
    { code: "GT", name: "Guatemala", dial: "+502" },
    { code: "CR", name: "Costa Rica", dial: "+506" },
    { code: "PA", name: "Panamá", dial: "+507" },
    { code: "DO", name: "Rep. Dominicana", dial: "+1" },
    { code: "HN", name: "Honduras", dial: "+504" },
    { code: "SV", name: "El Salvador", dial: "+503" },
    { code: "NI", name: "Nicaragua", dial: "+505" },
    { code: "BO", name: "Bolivia", dial: "+591" },
    { code: "PY", name: "Paraguay", dial: "+595" },
    { code: "UY", name: "Uruguay", dial: "+598" },
    { code: "CU", name: "Cuba", dial: "+53" },
    { code: "BR", name: "Brasil", dial: "+55" },
];

interface PhoneInputProps {
    label?: string;
    value: string;
    onChange: (fullPhone: string) => void;
    required?: boolean;
    error?: string;
}

/** Teléfono con lada: un solo campo con la forma de `fieldClass` (48 px, 8 px, fondo-2) y un divisor entre la lada y el número. */
export default function PhoneInput({ label, value, onChange, required, error }: PhoneInputProps) {
    const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRY_CODES[0]); // Por defecto: México
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const id = useId();
    const inputId = `${id}-phone`;
    const listId = `${id}-countries`;
    const errorId = `${id}-error`;

    // Número sin la lada del país
    const phoneNumber = value.startsWith(selectedCountry.dial)
        ? value.slice(selectedCountry.dial.length).trim()
        : value.replace(/^\+\d+\s*/, "");

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch("");
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const close = () => {
        setIsOpen(false);
        setSearch("");
        triggerRef.current?.focus();
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange(`${selectedCountry.dial} ${raw}`);
    };

    const handleSelectCountry = (country: CountryCode) => {
        setSelectedCountry(country);
        onChange(`${country.dial} ${phoneNumber}`);
        close();
    };

    const filteredCountries = search
        ? COUNTRY_CODES.filter(
            (c) =>
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.dial.includes(search) ||
                c.code.toLowerCase().includes(search.toLowerCase())
        )
        : COUNTRY_CODES;

    return (
        <div className="flex w-full flex-col gap-2">
            {label && (
                <label htmlFor={inputId} className="text-sm font-medium leading-none">
                    {label}
                </label>
            )}
            <div
                className={cn(
                    fieldClass,
                    "flex items-stretch px-0 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-acento"
                )}
                aria-invalid={error ? true : undefined}
            >
                {/* Lada */}
                <div
                    className="relative flex"
                    ref={dropdownRef}
                    onKeyDown={(e) => {
                        if (e.key === "Escape" && isOpen) {
                            e.stopPropagation();
                            close();
                        }
                    }}
                >
                    <button
                        ref={triggerRef}
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        aria-haspopup="true"
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? listId : undefined}
                        aria-label={`Lada: ${selectedCountry.name} ${selectedCountry.dial}. Cambiar país`}
                        className="flex h-full items-center gap-2 whitespace-nowrap rounded-l-[8px] px-4 text-base leading-none text-tinta tabular transition-colors hover:bg-fondo-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acento"
                    >
                        <span className="text-tinta-2">{selectedCountry.code}</span>
                        <span>{selectedCountry.dial}</span>
                        <ChevronDown aria-hidden className={`size-4 text-tinta-2 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    <span aria-hidden className="my-3 w-px bg-[var(--linea-fuerte)]" />

                    {isOpen && (
                        <div className={cn(floatingPanelClass, "absolute left-0 top-full mt-1 max-h-72 w-72 overflow-auto")}>
                            <div className="sticky top-0 bg-fondo-2 p-2">
                                <input
                                    type="text"
                                    placeholder="Buscar país…"
                                    aria-label="Buscar país"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-10 w-full rounded-[8px] bg-fondo px-3 text-sm text-tinta placeholder:text-tinta-2/70 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-acento"
                                    autoFocus
                                />
                            </div>
                            <ul id={listId} aria-label="Países">
                                {filteredCountries.map((country) => {
                                    const isCurrent = selectedCountry.code === country.code;
                                    return (
                                        <li key={country.code}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectCountry(country)}
                                                aria-current={isCurrent ? "true" : undefined}
                                                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-fondo-3 focus-visible:-outline-offset-2 ${isCurrent ? "text-acento" : "text-tinta"}`}
                                            >
                                                <span className="w-7 text-tinta-2">{country.code}</span>
                                                <span className="flex-1">{country.name}</span>
                                                <span className="tabular text-tinta-2">{country.dial}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                            {filteredCountries.length === 0 && (
                                <p className="px-3 py-4 text-sm text-tinta-2">Ningún país coincide con “{search}”.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Número */}
                <input
                    id={inputId}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="55 1234 5678"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="h-full min-w-0 flex-1 bg-transparent px-4 text-base text-tinta tabular placeholder:text-tinta-2 outline-none"
                />
            </div>
            {error && <p id={errorId} className="text-sm text-error">{error}</p>}
        </div>
    );
}
