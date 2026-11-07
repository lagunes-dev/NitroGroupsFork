import { useId } from "react";
import { Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ImageUrlField } from "./ImageUrlField";
import type { MusicGroup } from "../../types/MusicGroup";
import type { GenreListItem } from "../../services/groups.service";

type GroupProfileEditProps = {
  group: MusicGroup;
  originalGroup: MusicGroup;
  selectedGenres: number[];
  setSelectedGenres: React.Dispatch<React.SetStateAction<number[]>>;
  isPending: boolean;
  /** Mensaje si el último guardado falló. */
  saveError?: string | null;
  genres: GenreListItem[];
  isGenresLoading: boolean;
  handleSave: (e: React.FormEvent) => void;
  handleCancel: () => void;
  set: <K extends keyof MusicGroup>(k: K, v: MusicGroup[K]) => void;
};

const CURRENCY_OPTIONS = [
  { value: "MXN", label: "Pesos (MXN)" },
  { value: "USD", label: "Dólares (USD)" },
];

/** Campo numérico con un prefijo de moneda dentro del control. */
function MoneyInput({ id, label, value, onChange }: { id: string; label: string; value: number | undefined; onChange: (v: number | undefined) => void }) {
  return (
    <Input
      id={id}
      label={label}
      type="number"
      inputMode="numeric"
      min={0}
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || undefined)}
      icon={<span aria-hidden>$</span>}
      className="tabular"
    />
  );
}

export default function GroupProfileEdit({
  group,
  selectedGenres,
  setSelectedGenres,
  isPending,
  saveError,
  genres,
  isGenresLoading,
  handleSave,
  handleCancel,
  set,
}: GroupProfileEditProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const genresLabelId = id("genres-label");

  const toggleGenre = (genreId: number) =>
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]));

  return (
    <form onSubmit={handleSave} aria-labelledby={id("title")} className="pt-10 md:pt-14">
      <div className="max-w-[64ch]">
        <h1 id={id("title")} className="type-heading text-4xl md:text-5xl">Editar perfil</h1>
        <p className="mt-3 text-tinta-2">
          Así te ven los clientes en tu perfil público. Los cambios se publican al guardar.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-x-16 gap-y-14 lg:grid-cols-12">
        {/* Cómo se presenta el grupo */}
        <fieldset className="min-w-0 space-y-6 lg:col-span-7">
          <legend className="type-heading mb-6 text-2xl">Cómo te presentas</legend>

          <Input id={id("name")} label="Nombre del grupo (obligatorio)" value={group.groupName} onChange={(e) => set("groupName", e.target.value)}
            placeholder="Ej. Los Relámpagos" required autoComplete="organization" />

          <Input id={id("description")} label="Descripción corta" helperText={`${group.description?.length ?? 0} de 150`}
            value={group.description} onChange={(e) => set("description", e.target.value)}
            placeholder="Una frase que defina a tu grupo" maxLength={150} />

          <Textarea id={id("biography")} label="Biografía" rows={6} value={group.biography} onChange={(e) => set("biography", e.target.value)}
            placeholder="Historia, estilo, dónde han tocado…" />

          <div role="group" aria-labelledby={genresLabelId} aria-describedby={id("genres-hint")}>
            <p id={genresLabelId} className="mb-1 text-sm font-medium text-tinta">Géneros</p>
            <p id={id("genres-hint")} className="mb-3 text-sm text-tinta-2">Elige los que mejor describen lo que tocas.</p>
            {isGenresLoading ? (
              <p className="text-tinta-2" aria-busy>Cargando géneros…</p>
            ) : genres.length === 0 ? (
              <p className="text-tinta-2">No pudimos cargar la lista de géneros. Puedes guardar el resto de cambios.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {genres.map((genre) => {
                  const isSelected = selectedGenres.includes(genre.id);
                  return (
                    <button
                      key={genre.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleGenre(genre.id)}
                      className={`inline-flex h-10 items-center gap-1.5 px-3.5 text-[0.95rem] font-medium transition-colors duration-150 ${
                        // Seleccionado en tinta invertida: el acento queda para la acción de guardar.
                        isSelected ? "bg-tinta text-fondo hover:bg-tinta-2" : "bg-fondo-2 rounded-xl text-tinta hover:bg-fondo-3"
                      }`}
                    >
                      {isSelected && <Check aria-hidden className="size-4" />}
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <ImageUrlField id={id("avatar")} label="Foto de perfil" groupId={group.id}
              value={group.profilePictureUrl || ""} onChange={(url) => set("profilePictureUrl", url)} />
            <ImageUrlField id={id("cover")} label="Portada" groupId={group.id}
              value={group.coverImageUrl || ""} onChange={(url) => set("coverImageUrl", url)}
              helperText="Sin portada, tu perfil usa la primera foto de la galería." />
          </div>
        </fieldset>

        {/* Cómo se contrata */}
        <fieldset className="min-w-0 space-y-6 lg:col-span-5">
          <legend className="type-heading mb-6 text-2xl">Cómo te contratan</legend>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <MoneyInput id={id("base")} label="Precio base" value={group.basePrice} onChange={(v) => set("basePrice", v)} />
            <MoneyInput id={id("hourly")} label="Precio por hora" value={group.hourlyRate} onChange={(v) => set("hourlyRate", v)} />
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <Select id={id("currency")} label="Moneda" value={group.currency || "MXN"} onValueChange={(v) => set("currency", v)} options={CURRENCY_OPTIONS} />
            <Input id={id("radius")} label="Viaja hasta (km)" type="number" inputMode="numeric" min={0} value={group.serviceRadiusKm}
              onChange={(e) => set("serviceRadiusKm", Number(e.target.value))} className="tabular" />
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <Input id={id("min-hours")} label="Contratación mínima (horas)" type="number" inputMode="numeric" min={1} value={group.minimumDurationHours || 1}
              onChange={(e) => set("minimumDurationHours", Number(e.target.value))} className="tabular" />
            <Input id={id("setup")} label="Montaje (minutos)" type="number" inputMode="numeric" min={0} step={15} value={group.setupTimeMinutes || 0}
              onChange={(e) => set("setupTimeMinutes", Number(e.target.value))} className="tabular" />
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <Input id={id("location")} label="Ciudad" value={group.locationText} onChange={(e) => set("locationText", e.target.value)}
              placeholder="Ciudad, estado" autoComplete="address-level2" />
            {/* S22: el número que el músico ve en su toque. El campo vacío es el interruptor. */}
            <Input id={id("phone")} label="Teléfono del grupo" type="tel" inputMode="tel" autoComplete="tel" maxLength={20}
              value={group.phone} onChange={(e) => set("phone", e.target.value)} placeholder="33 1234 5678"
              helperText="Lo ven solo los integrantes activos de tu grupo, en sus toques. Si lo dejas vacío, nadie lo ve." />
          </div>

          {/* Ronda 9: el grupo escribe cómo quiere que se le pague. La app no cobra: solo lo repite.
              Ronda 10: la ayuda dice qué escribir; un "transfiere" suelto deja al cliente preguntando por el chat. */}
          <Textarea id={id("payment")} label="Cómo pagar" rows={4} maxLength={500}
            value={group.paymentInstructions ?? ""} onChange={(e) => set("paymentInstructions", e.target.value)}
            placeholder="Ej. Transferencia a la CLABE 0121 8000 1234 5678, BBVA, a nombre de Mónica Salinas."
            helperText={`${group.paymentInstructions?.length ?? 0} de 500 · Escribe la cuenta, a nombre de quién va, dónde mandas el comprobante y el concepto: solo lo ve el cliente de un evento aceptado.`} />

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            {/* El número sale del equipo real: un campo editable acá sería un control que la app ignora. */}
            <div className="flex flex-col gap-1">
              <p className="text-sm text-tinta-2">Integrantes</p>
              <p className="tabular type-heading text-xl text-tinta">{group.numMembers || 0}</p>
              <p className="text-sm text-tinta-2">Lo cuenta el equipo: se suma solo cuando alguien entra o sale.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2">
            <Input id={id("years")} label="Años de experiencia" type="number" inputMode="numeric" min={0} value={group.yearsExperience || 0}
              onChange={(e) => set("yearsExperience", Number(e.target.value))} className="tabular" />
          </div>

          {/* Interruptor accesible: el estado se lee en el texto, no solo en el color. */}
          <div className="flex items-start justify-between gap-6 bg-fondo-2 rounded-xl px-4 py-4">
            <div>
              <p id={id("accepting-label")} className="font-medium text-tinta">Recibir solicitudes</p>
              <p id={id("accepting-hint")} className="mt-1 text-sm text-tinta-2">
                {group.isAcceptingBookings
                  ? "Los clientes pueden pedirte fechas."
                  : "En pausa: tu perfil sigue visible, pero nadie puede pedirte una fecha."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={group.isAcceptingBookings}
              aria-labelledby={id("accepting-label")}
              aria-describedby={id("accepting-hint")}
              onClick={() => set("isAcceptingBookings", !group.isAcceptingBookings)}
              className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento ${group.isAcceptingBookings ? "bg-acento" : "bg-fondo-3"}`}
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1 size-5 rounded-full transition-transform duration-150 ${group.isAcceptingBookings ? "translate-x-6 bg-fondo" : "translate-x-1 bg-tinta-2"}`}
              />
            </button>
          </div>
        </fieldset>
      </div>

      {/* Barra de acciones fija al pie: guardar siempre a la vista en formularios largos. */}
      <div className="sticky bottom-0 z-30 mt-14 -mx-[var(--gutter)] bg-fondo px-[var(--gutter)] pb-4 pt-3">
        <div className="flex flex-col gap-3 bg-fondo-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite" className="min-w-0 sm:px-2">
            {saveError ? (
              <Alert variant="destructive" className="bg-transparent p-0">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-tinta-2">{isPending ? "Guardando cambios…" : "Nada se publica hasta que guardes."}</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={isPending}>
              Descartar cambios
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <span aria-hidden className="spinner !size-[1em] !border-2" />}
              {isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
