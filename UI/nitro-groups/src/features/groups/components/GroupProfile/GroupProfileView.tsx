import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";
import { ROUTES } from "@/config/routes";
import GroupCalendar from "@/features/groupAvailability/components/GroupCalendar";
import { joinSpanish, ownerFacts, profileGaps } from "../../lib/ownerSummary";
import type { MusicGroup } from "../../types/MusicGroup";

type GroupProfileViewProps = {
  group: MusicGroup;
  isPublic: boolean;
  toggleEdit: () => void;
};

/**
 * Cabecera del panel del grupo: quién es (foto y nombre en voz de cartel), si recibe
 * solicitudes, los datos con los que un cliente decide y lo que le falta al perfil.
 * Compacta a propósito: debajo vive la bandeja, que es el trabajo diario.
 */
export default function GroupProfileView({ group, isPublic, toggleEdit }: GroupProfileViewProps) {
  const name = group.groupName.trim() || "Tu grupo";
  const photo = group.profilePictureUrl || group.coverImageUrl;
  const genres = (group.genres ?? []).map((g) => g.name);
  const facts = ownerFacts(group);
  const gaps = isPublic ? [] : profileGaps(group);

  return (
    <header className="pt-10 md:pt-14">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-5 gap-y-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-8">
        <Photo
          src={photo}
          alt={`Foto de ${name}`}
          fallbackTitle={name}
          priority
          className="size-20 md:size-32"
        />

        <div className="min-w-0">
          <h1 className="titulo break-words">{name}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.95rem]">
            {group.isAcceptingBookings ? (
              <span className="inline-flex items-center gap-2 text-ok">
                <span aria-hidden className="size-2 rounded-full bg-current" />
                Recibiendo pedidos de fecha
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-tinta-2">
                <span aria-hidden className="size-2 rounded-full border-2 border-current" />
                Pedidos de fecha en pausa
              </span>
            )}
            {group.isVerified && (
              <span className="inline-flex items-center gap-1.5 text-tinta">
                <BadgeCheck aria-hidden className="size-4 text-acento" />
                Verificado
              </span>
            )}
          </p>
        </div>

        {!isPublic && (
          <div className="col-span-2 flex gap-2 md:col-span-1 md:justify-end [&>*]:flex-1 md:[&>*]:flex-none">
            <Button variant="secondary" onClick={toggleEdit}>
              <Pencil aria-hidden /> Editar perfil
            </Button>
            {group.slug && (
              <Button variant="ghost" asChild>
                <Link href={ROUTES.GROUPS.PUBLIC_PROFILE(group.slug)}>
                  Ver perfil público <ArrowUpRight aria-hidden />
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {(group.description || genres.length > 0) && (
        <div className="mt-6 max-w-[64ch] space-y-2">
          {group.description && <p className="text-tinta">{group.description}</p>}
          {genres.length > 0 && <p className="text-tinta-2">{joinSpanish(genres)}</p>}
        </div>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 rounded-[12px] bg-fondo-2 p-5 sm:grid-cols-3 md:px-6 xl:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1.3fr]">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-sm leading-5 text-tinta-2">{fact.label}</dt>
            <dd
              title={fact.value}
              className={`type-heading mt-1 break-words text-lg leading-7 tabular sm:truncate ${fact.missing ? "text-tinta-2" : "text-tinta"}`}
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {gaps.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-[12px] bg-fondo-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 md:px-6">
          <p className="text-tinta">
            <span className="text-tinta-2">A tu perfil le falta </span>
            {joinSpanish(gaps)}.
            <span className="text-tinta-2"> Con esos datos un cliente se decide sin tener que escribirte.</span>
          </p>
          <Button size="sm" variant="link" onClick={toggleEdit} className="self-start px-0 sm:shrink-0 sm:self-auto">
            Completar perfil
          </Button>
        </div>
      )}

      {isPublic && (
        <section className="mt-16" aria-labelledby="disponibilidad">
          <h2 id="disponibilidad" className="type-heading mb-6 text-3xl">Disponibilidad</h2>
          <GroupCalendar groupId={group.id} mode="public" />
        </section>
      )}
    </header>
  );
}
