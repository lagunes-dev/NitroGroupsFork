"use client";

import { ReactNode, useCallback, useEffect, useId, useRef, useState, Children, isValidElement, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { tabCountLabel } from "@/lib/tabCount";

interface TabItemProps {
  title: string;
  tabKey: string;
  /** Etiqueta corta para 390 px: el nombre accesible sigue siendo `title`. */
  shortTitle?: string;
  /** Pending items: a small pill after the title, hidden at 0 or when omitted. */
  count?: number;
  /** Accessible name of the tab; by default the title plus the count ("Equipo, 2 pendientes"). */
  countLabel?: string;
  children: ReactNode;
}

export function TabItem({ children }: TabItemProps) {
  return <>{children}</>;
}

interface TabbedSectionProps {
  children: ReactNode;
  /** Nombre accesible de la lista de pestañas. */
  label?: string;
  className?: string;
  /** Controlled mode: the key of the active tab. Without it the component manages the tab itself. */
  activeKey?: string;
  /** Called with the key of the tab the user picked (controlled or not). */
  onActiveKeyChange?: (tabKey: string) => void;
}

/**
 * Pestañas de texto con un subrayado acento de 2px en la activa. Patrón WAI-ARIA: flechas
 * izquierda/derecha, Inicio y Fin mueven el foco y activan; solo la pestaña activa entra en el
 * orden de tabulación.
 *
 * A 390 px no caben todas las pestañas (T34) y esconderlas en silencio deja opciones que nadie sabe
 * que existen. Tres señales lo evitan: cada pestaña puede llevar un rótulo corto, el borde por el
 * que queda contenido se difumina, y la pestaña elegida se trae a la vista.
 */
export default function TabbedSection({ children, label, className, activeKey, onActiveKeyChange }: TabbedSectionProps) {
  const tabs: { title: string; shortTitle?: string; tabKey: string; count?: number; countLabel?: string; content: ReactNode }[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    const { title, shortTitle, tabKey, count, countLabel, children: tabContent } = child.props as Partial<TabItemProps>;

    if (typeof title !== "string" || typeof tabKey !== "string") return;

    tabs.push({
      title,
      shortTitle: typeof shortTitle === "string" && shortTitle.trim() ? shortTitle : undefined,
      tabKey,
      count,
      countLabel,
      content: tabContent,
    });
  });

  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [chosenKey, setSelectedKey] = useState("");

  // La pestaña activa se deriva: la elegida si sigue existiendo, si no la primera.
  const currentKey = activeKey ?? chosenKey;
  const selectedKey = tabs.some((tab) => tab.tabKey === currentKey) ? currentKey : (tabs[0]?.tabKey ?? "");
  const select = (key: string) => {
    if (activeKey === undefined) setSelectedKey(key);
    onActiveKeyChange?.(key);
  };
  const activeTab = tabs.find((t) => t.tabKey === selectedKey);

  const tabId = (key: string) => `${baseId}-tab-${key}`;
  const panelId = (key: string) => `${baseId}-panel-${key}`;

  /** Qué bordes esconden pestañas: sin desbordamiento no se dibuja ninguna señal. */
  const measure = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const hidden = bar.scrollWidth - bar.clientWidth;
    const next = { start: bar.scrollLeft > 1, end: hidden > 1 && bar.scrollLeft < hidden - 1 };
    setEdges((previous) => (previous.start === next.start && previous.end === next.end ? previous : next));
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    measure();
    bar.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
    observer?.observe(bar);
    return () => {
      bar.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  // La pestaña elegida se trae a la vista: si "Mi perfil" arranca fuera de la pantalla, la señal no
  // sirve de nada (ronda 6, Mateo midió el arranque en x=445). Se mueve la barra, nunca la página.
  useEffect(() => {
    const bar = barRef.current;
    const index = tabs.findIndex((tab) => tab.tabKey === selectedKey);
    const tab = tabRefs.current[index];
    if (!bar || !tab || !bar.clientWidth) return;
    const start = tab.offsetLeft;
    const end = start + tab.offsetWidth;
    if (start < bar.scrollLeft) bar.scrollLeft = start;
    else if (end > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = end - bar.clientWidth;
    // Solo cuando cambia la pestaña elegida: las medidas se leen del navegador, no del render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((t) => t.tabKey === selectedKey);
    if (current < 0) return;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].tabKey);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={className}>
      {/* El difuminado del borde va sobre la barra, no dentro: dentro lo recortaría overflow-x-auto. */}
      <div className="relative">
        <div
          ref={barRef}
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
          // La línea base va como sombra interior: un borde real quedaría fuera del área que recorta
          // overflow-x-auto y taparía el subrayado de la pestaña activa.
          className="flex gap-4 overflow-x-auto shadow-[inset_0_-2px_0_var(--fondo-2)] sm:gap-8"
        >
          {tabs.map((tab, i) => {
            const isSelected = tab.tabKey === selectedKey;
            const pending = tab.count !== undefined && tab.count > 0;
            return (
              <button
                key={tab.tabKey}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={tabId(tab.tabKey)}
                aria-selected={isSelected}
                aria-controls={panelId(tab.tabKey)}
                aria-label={pending ? (tab.countLabel ?? tabCountLabel(tab.title, tab.count)) : tab.shortTitle ? tab.title : undefined}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => select(tab.tabKey)}
                className={cn(
                  // gap-2: el rótulo y la píldora del pendiente nunca se pegan (la ronda 6 leyó "Equipo1").
                  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-1 font-semibold transition-colors duration-150 focus-visible:-outline-offset-2",
                  isSelected
                    ? "border-acento text-tinta"
                    : "border-transparent text-tinta-2 hover:border-fondo-3 hover:text-tinta",
                )}
              >
                <span data-label="compact" aria-hidden={tab.shortTitle ? true : undefined} className={tab.shortTitle ? "sm:hidden" : undefined}>
                  {tab.shortTitle ?? tab.title}
                </span>
                {tab.shortTitle && (
                  <span data-label="full" aria-hidden className="hidden sm:inline">
                    {tab.title}
                  </span>
                )}
                {pending && (
                  <>
                    {" "}
                    <span
                      aria-hidden
                      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-acento px-1.5 text-xs font-semibold tabular text-acento-ink"
                    >
                      {tab.count}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {edges.start && (
          <span
            data-edge="start"
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-fondo to-transparent"
          />
        )}
        {edges.end && (
          <span
            data-edge="end"
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-fondo to-transparent"
          />
        )}
      </div>

      {activeTab && (
        <div
          role="tabpanel"
          id={panelId(activeTab.tabKey)}
          aria-labelledby={tabId(activeTab.tabKey)}
          tabIndex={0}
          className="focus-visible:outline-offset-8"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}
