"use client";

import { ReactNode, useId, useRef, useState, Children, isValidElement, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { tabCountLabel } from "@/lib/tabCount";

interface TabItemProps {
  title: string;
  tabKey: string;
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
 */
export default function TabbedSection({ children, label, className, activeKey, onActiveKeyChange }: TabbedSectionProps) {
  const tabs: { title: string; tabKey: string; count?: number; countLabel?: string; content: ReactNode }[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    const { title, tabKey, count, countLabel, children: tabContent } = child.props as Partial<TabItemProps>;

    if (typeof title !== "string" || typeof tabKey !== "string") return;

    tabs.push({
      title,
      tabKey,
      count,
      countLabel,
      content: tabContent,
    });
  });

  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
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
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        // La línea base va como sombra interior: un borde real quedaría fuera del área que recorta
        // overflow-x-auto y taparía el subrayado de la pestaña activa.
        className="flex gap-8 overflow-x-auto shadow-[inset_0_-2px_0_var(--fondo-2)]"
      >
        {tabs.map((tab, i) => {
          const isSelected = tab.tabKey === selectedKey;
          return (
            <button
              key={tab.tabKey}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={tabId(tab.tabKey)}
              aria-selected={isSelected}
              aria-controls={panelId(tab.tabKey)}
              aria-label={tab.count && tab.count > 0 ? (tab.countLabel ?? tabCountLabel(tab.title, tab.count)) : undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => select(tab.tabKey)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 pb-3 pt-1 font-semibold transition-colors duration-150 focus-visible:-outline-offset-2",
                isSelected
                  ? "border-acento text-tinta"
                  : "border-transparent text-tinta-2 hover:border-fondo-3 hover:text-tinta",
              )}
            >
              {tab.title}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-acento px-1.5 text-xs font-semibold tabular text-acento-ink">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
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
