import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { statusAppearance } from "../status";

/** Status chip: colour + icon + word, never colour alone. A status we do not know prints as it arrived, in a neutral tone. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const { text, variant, className: tone, icon: Icon } = statusAppearance(status);
    return (
        <Badge variant={variant} className={cn(tone, className)}>
            <Icon aria-hidden className="size-4 shrink-0" />
            {text}
        </Badge>
    );
}
