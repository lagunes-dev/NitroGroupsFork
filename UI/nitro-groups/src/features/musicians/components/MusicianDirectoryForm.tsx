import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DIRECTORY_HREF, FILTER_MAX, type DirectoryFilters } from "../directory";

/** Same wording as the group search: an empty field says it does not filter. */
const NO_FILTER = "Sin filtro";

/**
 * Directory filters. A plain GET form: it works without JavaScript and leaves the filters in the
 * URL, so a search can be shared or reached with the back button. Submitting always lands on page 1.
 */
export function MusicianDirectoryForm({ filters }: { filters: DirectoryFilters }) {
    return (
        <form action={DIRECTORY_HREF} method="get" role="search" aria-label="Buscar músicos" className="w-full">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
                <div className="min-w-[200px] flex-[1_1_200px]">
                    <Input
                        id="musicos-nombre"
                        name="query"
                        label="Nombre"
                        defaultValue={filters.query}
                        placeholder={filters.query ? undefined : NO_FILTER}
                        maxLength={FILTER_MAX}
                        autoComplete="off"
                    />
                </div>
                <div className="min-w-[200px] flex-[1_1_200px]">
                    <Input
                        id="musicos-instrumento"
                        name="instrument"
                        label="Instrumento"
                        defaultValue={filters.instrument}
                        placeholder={filters.instrument ? undefined : NO_FILTER}
                        maxLength={FILTER_MAX}
                        autoComplete="off"
                    />
                </div>
                <div className="min-w-[200px] flex-[1_1_200px]">
                    <Input
                        id="musicos-ciudad"
                        name="city"
                        label="Ciudad"
                        defaultValue={filters.city}
                        placeholder={filters.city ? undefined : NO_FILTER}
                        maxLength={FILTER_MAX}
                        autoComplete="address-level2"
                    />
                </div>
                <Button type="submit" size="lg" className="w-full rounded-[8px] sm:w-auto sm:px-8">
                    Buscar músicos
                </Button>
            </div>
        </form>
    );
}
