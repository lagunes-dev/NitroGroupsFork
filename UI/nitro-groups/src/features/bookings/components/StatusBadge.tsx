import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { statusAppearance } from "../status";

/**
 * Chip de estado: color + icono + palabra, nunca solo color. Un estado que no conocemos se
 * muestra tal cual llegó, en tono neutro.
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const { text, variant, className: tone, icon: Icon } = statusAppearance(status);
    return (
        <Badge variant={variant} className={cn(tone, className)}>
            <Icon aria-hidden className="size-4 shrink-0" />
            {text}
        </Badge>
    );
}
