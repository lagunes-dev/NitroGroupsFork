/**
 * Ronda 11: a 390 px la semana recortaba sus fichas. Medido por el informe: en las columnas de 41–42 px
 * una ficha pedía 72 px ("Disponible") y solo tenía 33, así que la palabra se partía sola. Lo que manda
 * es la ficha más larga que el calendario pinta dentro de una columna —"Toque confirmado", ~111 px a
 * 7,2 px por letra—: una columna necesita ~121 px para que entre completa, y siete columnas más el eje de
 * horas (~48 px) no bajan de ~895 px. Por eso la rejilla deja de encogerse a 60rem (960 px) y el espacio
 * que falta lo resuelve el contenedor que la envuelve, no la página.
 */
export const CALENDAR_GRID_MIN_WIDTH_CLASS = "ng-semana-rejilla min-w-[60rem]";

/**
 * The container that scrolls instead of the document: the grid overflows inside it, so the page's
 * `scrollWidth` stays equal to its `clientWidth`. `overscroll-x-contain` keeps a sideways swipe from
 * being handed to the page once the grid reaches its end.
 */
export const CALENDAR_SCROLLER_CLASS = "ng-semana-scroll overflow-x-auto overscroll-x-contain";

/**
 * Said only where the grid really scrolls (below `lg`), so the swipe is a fact the manager is told, not
 * a discovery. In a wide window the grid fits and there is nothing to say.
 */
export const CALENDAR_SWIPE_HINT = "Desliza el calendario para ver la semana completa.";
