import { ROUTES } from "@/config/routes";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { todayInMexico } from "@/lib/format";
import type { GenreOption, SearchFilters } from "../types";

interface SearchFormProps {
    genres: GenreOption[];
    values?: SearchFilters;
    /** En la página de resultados se muestra también el presupuesto. */
    showBudget?: boolean;
    submitLabel?: string;
    id?: string;
    /** "glass": la barra de la portada, un panel de vidrio con los campos dentro. */
    variant?: "plain" | "glass";
}

/**
 * Buscador de grupos. Es un formulario GET normal: funciona sin JavaScript y deja la
 * búsqueda en la URL para compartirla o volver atrás. Select y DatePicker envían su valor
 * con un input oculto, así que la URL conserva `genero`, `ciudad`, `fecha` y `presupuesto`.
 */
export function SearchForm({ genres, values = {}, showBudget = false, submitLabel = "Buscar grupos", id = "buscar", variant = "plain" }: SearchFormProps) {
    const glass = variant === "glass";

    return (
        <form action={ROUTES.GROUPS.SEARCH} method="get" role="search" aria-label="Buscar grupos" className={glass ? "w-full vidrio rounded-xl p-4" : "w-full"}>
            {/* Los campos comparten una sola línea de base (items-end) y cada uno mide al menos 200px antes de pasar a la fila de abajo. */}
            <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
                <div className="min-w-[200px] flex-[1.2_1_220px]">
                    <Select
                        id={`${id}-genero`}
                        name="genero"
                        label="Música"
                        emptyOption="Cualquier género"
                        defaultValue={values.genero ?? ""}
                        options={genres.map((g) => ({ value: g.slug, label: g.name }))}
                    />
                </div>
                <div className="min-w-[200px] flex-[1_1_200px]">
                    <Input id={`${id}-ciudad`} name="ciudad" label="Ciudad" defaultValue={values.ciudad ?? ""} placeholder="Guadalajara" autoComplete="address-level2" />
                </div>
                <div className="min-w-[200px] flex-[1_1_200px]">
                    <DatePicker id={`${id}-fecha`} name="fecha" label="Fecha del evento" min={todayInMexico()} defaultValue={values.fecha ?? ""} />
                </div>
                {showBudget && (
                    <div className="min-w-[200px] flex-[1_1_200px]">
                        <Input
                            id={`${id}-presupuesto`}
                            name="presupuesto"
                            label="Presupuesto máximo"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={500}
                            defaultValue={values.presupuesto ?? ""}
                            placeholder="20000"
                            icon={<span aria-hidden>$</span>}
                            className="tabular"
                        />
                    </div>
                )}
                <Button type="submit" size="lg" className="w-full rounded-[8px] sm:w-auto sm:px-8">
                    {submitLabel}
                </Button>
            </div>
            {values.q && <input type="hidden" name="q" value={values.q} />}
        </form>
    );
}
