import { initials } from "@/lib/initials";

/** Round avatar: the profile picture when there is one, otherwise the person's initials. Decorative (the name sits beside it). */
export function Avatar({ name, src, className = "size-12" }: { name: string; src?: string | null; className?: string }) {
    const shape = `${className} shrink-0 rounded-full`;
    if (src) {
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary origin from the profile
        return <img src={src} alt="" className={`${shape} bg-fondo-3 object-cover`} />;
    }
    return (
        <span aria-hidden className={`${shape} grid place-items-center bg-fondo-3 text-sm font-semibold text-tinta-2`}>
            {initials(name)}
        </span>
    );
}
