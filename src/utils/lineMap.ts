/**
 * lineMap — conversión entre "posición en líneas lógicas" y píxeles.
 *
 * Una línea lógica es un elemento de `parsedLines` (acordes + letra juntos,
 * o una etiqueta de sección). La posición se expresa como un número decimal:
 *
 *   pos = 42.6  →  línea 42, al 60% de su altura.
 *
 * Esa posición no depende del tamaño de pantalla ni de la letra: cada
 * dispositivo la convierte a píxeles con sus propias alturas medidas.
 *
 * `tops` es un arreglo de longitud (cantidad de líneas + 1):
 *   tops[i]     = y (en coordenadas del contenido del ScrollView) donde empieza la línea i
 *   tops[count] = y donde termina la última línea
 */

/**
 * Fracción de la altura del viewport donde se ancla la línea "actual".
 * 0 = pegada al borde superior. Un valor chico deja ver algo de contexto
 * de lo que se acaba de tocar.
 */
export const LINE_ANCHOR_FRACTION = 0.15;

/**
 * Velocidad del pedal WiFi en líneas lógicas por segundo.
 * Es la misma para todos los dispositivos (a propósito: no depende del
 * ajuste "velocidad del pedal" de cada usuario, que está en píxeles).
 * Más adelante la va a definir el ESP32.
 */
export const WIFI_PEDAL_LINES_PER_SEC = 2;

/** Tiempo de aceleración / frenado del pedal WiFi. */
export const WIFI_PEDAL_RAMP_MS = 150;

/** Por debajo de esta velocidad (líneas/seg) el loop se considera detenido. */
export const LINE_MIN_VELOCITY = 0.02;

/** Tolerancia (px) para decidir si el scroll sigue donde lo dejó el modo líneas. */
export const LINE_TRUST_TOLERANCE_PX = 3;

/**
 * Arma el arreglo `tops` a partir de lo que reportó onLayout.
 *
 * - `ys[i]` / `hs[i]`: y y alto de la línea i, relativos al contenedor de la canción.
 * - `containerY`: y del contenedor dentro del contenido del ScrollView.
 * - Las líneas sin medir (por ejemplo las ocultas) quedan con alto cero,
 *   pegadas a la siguiente línea medida.
 * - Se fuerza que `tops` sea no decreciente por si quedó algún dato viejo.
 */
export const buildTops = (
    ys: ReadonlyArray<number | undefined>,
    hs: ReadonlyArray<number | undefined>,
    count: number,
    containerY: number,
    fallbackEnd: number
): number[] => {
    const tops = new Array<number>(count + 1);
    let end = -1;

    for (let i = 0; i < count; i++) {
        const y = ys[i];

        if (y === undefined) {
            tops[i] = NaN;
            continue;
        }

        const top = containerY + y;
        tops[i] = top;

        const bottom = top + (hs[i] ?? 0);
        if (bottom > end) end = bottom;
    }

    tops[count] = end >= 0 ? end : fallbackEnd;

    for (let i = count - 1; i >= 0; i--) {
        if (Number.isNaN(tops[i]) || tops[i] > tops[i + 1]) {
            tops[i] = tops[i + 1];
        }
    }

    return tops;
};

/** Posición en líneas → y (px) del contenido. */
export const posToY = (tops: ReadonlyArray<number>, pos: number): number => {
    const n = tops.length - 1;
    if (n <= 0) return 0;

    const p = Math.min(n, Math.max(0, pos));
    const i = Math.min(n - 1, Math.floor(p));
    const f = p - i;

    return tops[i] + f * (tops[i + 1] - tops[i]);
};

/** y (px) del contenido → posición en líneas. */
export const yToPos = (tops: ReadonlyArray<number>, y: number): number => {
    const n = tops.length - 1;
    if (n <= 0) return 0;
    if (y <= tops[0]) return 0;
    if (y >= tops[n]) return n;

    // Última línea i con tops[i] <= y
    let lo = 0;
    let hi = n - 1;

    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (tops[mid] <= y) lo = mid;
        else hi = mid - 1;
    }

    return lo + (y - tops[lo]) / (tops[lo + 1] - tops[lo]);
};

/**
 * Cantidad mínima de líneas lógicas que entran enteras en el viewport,
 * tomando el peor caso entre todas las posiciones de inicio posibles.
 *
 * Las ventanas que llegan al final de la canción no cuentan: ahí entran
 * menos líneas simplemente porque se terminó la canción.
 * Si la canción completa entra en pantalla devuelve la cantidad total.
 */
export const minVisibleLines = (
    tops: ReadonlyArray<number>,
    viewportHeight: number
): number => {
    const n = tops.length - 1;
    if (n <= 0 || viewportHeight <= 0) return 0;

    let min = Infinity;
    let j = 0; // las líneas [i, j) entran

    for (let i = 0; i < n; i++) {
        if (tops[i + 1] === tops[i]) continue; // línea sin altura (oculta)
        if (j < i) j = i;

        while (j < n && tops[j + 1] - tops[i] <= viewportHeight) j++;

        if (j >= n) break;

        const count = j - i;
        if (count < min) min = count;
    }

    return Number.isFinite(min) ? Math.max(1, min) : n;
};

/**
 * Pedal WiFi — corrección con la posición del servidor (ESP32).
 *
 * Mientras el loop local está corriendo, cada POS del servidor corrige una
 * fracción del error (SERVER_BLEND). Si el error supera SERVER_SNAP_LINES
 * (por ejemplo, el teléfono se perdió el inicio del movimiento) se salta
 * directo a la posición del servidor.
 */
export const SERVER_BLEND = 0.4;
export const SERVER_SNAP_LINES = 2;

/** Diferencias menores a esto (en líneas) no justifican mover el scroll. */
export const LINE_SYNC_EPSILON = 0.02;