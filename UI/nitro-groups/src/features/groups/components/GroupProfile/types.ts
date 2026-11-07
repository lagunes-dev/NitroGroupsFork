import type { MusicGroup } from "../../types/MusicGroup";

export type GroupProfileProps = {
  mode?: "private" | "public";
  slug?: string;
  initialGroup?: MusicGroup;
  /**
   * Ronda 10: abre el perfil ya en el formulario. El panel del manager ofrece editar el grupo como una
   * acción propia, para que editar sea un toque sin convertir la entrada de lectura en un formulario.
   * Por defecto `false`: leer el perfil sigue leyendo el perfil.
   */
  startInEdit?: boolean;
  /**
   * Ronda 10: the form takes the card's place, so the panel needs to know it to name what is on screen
   * and to avoid closing it without asking.
   */
  onEditingChange?: (editing: boolean) => void;
};

export type FieldProps = {
  label: string;
  /** id del control que etiqueta. */
  htmlFor: string;
  required?: boolean;
  /** Límite o aclaración junto al campo, ligado con aria-describedby desde el control. */
  hint?: string;
  children: React.ReactNode;
};
