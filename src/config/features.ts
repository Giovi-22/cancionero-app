/**
 * Feature flags de la app.
 *
 * Única fuente de verdad para decidir qué herramientas se muestran.
 * Los componentes nunca leen `process.env` ni `__DEV__` directamente:
 * importan `features` desde acá.
 *
 * ── Herramientas de debug ────────────────────────────────────────────
 * `features.debugTools` es true SOLO si se cumplen las dos condiciones:
 *
 *   1. `__DEV__` es true  → build de desarrollo (Metro / dev client).
 *      En un build de release `__DEV__` es false y las herramientas
 *      quedan apagadas aunque alguien deje la variable en true.
 *
 *   2. `EXPO_PUBLIC_ENABLE_DEBUG_TOOLS === 'true'` en el .env.
 *      Si la variable no existe (máquina nueva, CI, build de EAS sin la
 *      variable) las herramientas quedan apagadas: falla "cerrado".
 *
 * Importante sobre Expo:
 *  - Las variables EXPO_PUBLIC_* se inyectan al compilar el bundle, y
 *    deben leerse con acceso estático (`process.env.EXPO_PUBLIC_X`);
 *    no funciona desestructurar ni acceder con una clave dinámica.
 *  - Al cambiar el .env hay que reiniciar Metro: `npx expo start -c`.
 *  - Son valores PÚBLICOS (quedan dentro del bundle). Sirven para
 *    mostrar/ocultar UI, no para proteger secretos.
 */

const DEBUG_TOOLS_ENV =
  process.env.EXPO_PUBLIC_ENABLE_DEBUG_TOOLS === 'true';


export const features = {
  /** Herramientas internas: modo depuración, ver ChordPro, editor visual, etc. */
  debugTools: __DEV__ && DEBUG_TOOLS_ENV,
} as const;

export type Features = typeof features;
