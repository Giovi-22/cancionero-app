# Diagnóstico — Refactorización de Contexts (UserContext / BandContext / AppContext)

**Fecha:** 2026-09-07
**Alcance:** revisión estática del código provisto (`proyecto.zip`), sin modificar archivos, contra el plan de refactorización arquitectónica.

## Resumen ejecutivo

La migración está **parcialmente hecha pero incompleta**. Los tres contexts existen y están bien separados en su diseño, pero el paso 6 del plan ("Migrar pantallas y componentes") quedó a mitad de camino: hay una pantalla completa y dos componentes globales que todavía leen la banda activa desde una fuente distinta a `BandContext`. Uno de estos casos no es solo deuda técnica: es un **bug funcional activo** (estado muerto que siempre vale `null`).

---

## ✅ Lo que ya está bien hecho

- `UserContext`, `BandContext` y `AppContext` existen como archivos separados con responsabilidades declaradas correctamente.
- `BandContext` envuelve una **única instancia** de `useBands()` (`src/context/BandContext.tsx`) — patrón correcto.
- `AppContext` **no duplica** `user` / `userId`: consume `useUserContext()` en vez de mantener su propio estado de usuario.
- `AppContext` **no duplica** `userRole` ni `permissions`: esos campos no existen en su estado.
- El orden de providers en `app/_layout.tsx` es correcto:
  `UserContextProvider` → `BandContextProvider` → `DebugContextProvider` → `AppContextProvider`.
  Esto significa que `AppContext` sí podría consumir `BandContext` sin problema de dependencia circular.
- `app/(tabs)/band/setlists/[id].tsx` y `app/(tabs)/band/setlists/index.tsx` **están migrados correctamente**: usan `useBandContext()` y derivan `activeBandId` desde `selectedBand?.id`, tal como pide el plan.
- `useBandSetlists(bandId)` y `useDirectorSession(bandId)` están correctamente parametrizados por `bandId` externo — no mantienen su propia "banda activa" interna.

---

## 🔴 Violaciones de la regla central

> "No debe existir una combinación de `activeBandId` desde un contexto y `selectedBand`, `userRole` o `permissions` desde una instancia independiente de `useBands()`."

### 1. `AppContext` todavía mantiene su propio `activeBandId` — y es estado muerto

`src/context/AppContext.tsx` (línea 169) define `const [activeBandId, setActiveBandId] = useState<string | null>(null)` y lo expone en el contexto.

**`setActiveBandId` no se llama en ningún lugar del código.** Búsqueda exhaustiva sobre todo el repo confirma cero call sites. Es decir: ese valor queda **siempre en `null`**, para siempre, en toda la app.

Esto rompe en producción a tres consumidores:

| Archivo | Problema |
|---|---|
| `src/components/DirectorSessionBanner.tsx` | Se monta globalmente en `app/_layout.tsx`. Lee `activeBandId` de `useAppContext()` → siempre `null` → hace `return null`. **El banner de Director Mode nunca se muestra en ninguna pantalla de la app.** |
| `app/song/[id].tsx` | Llama `useDirectorSession(activeBandId)` con el `activeBandId` (siempre `null`) de `AppContext`, en vez de `useBandContext().selectedBand?.id`. **El seguimiento del Director Mode en la pantalla de canción no funciona.** |
| `src/screens/HomeScreen.tsx` | Desestructura `activeBandId` de `useAppContext()` (siempre `null`). Revisar si se usa más adelante en el archivo; si se pasa a algún componente hijo, ese componente también está roto. |

### 2. `app/(tabs)/band/index.tsx` usa `useBands()` directo en vez de `useBandContext()`

Esta es la **pantalla principal de "Banda"** (1311 líneas) — donde el usuario selecciona y crea bandas. Llama a `useBands()` directamente, creando una instancia paralela completa con su propio `selectedBand`, `userRole`, `permissions`, `members`, `selectBand`, `createBand`.

Como `useBands()` mantiene estado de React y listeners de Firestore **por instancia** (no es un singleton), esto significa:

- Al seleccionar una banda en esta pantalla, **`BandContext` no se entera** — es una instancia distinta con su propio estado.
- `setlists/[id].tsx` y `setlists/index.tsx` (que sí leen de `BandContext`) pueden mostrar una banda distinta a la que el usuario acaba de seleccionar en la pantalla principal, hasta que la suscripción reactiva de cada instancia converja de forma independiente.

Esto es exactamente el "Problema actual" que describe el plan, sin resolver en la pantalla más importante del feature de bandas.

### 3. `src/screens/HomeScreen.tsx` también llama `useBands()` directo

Solo para leer `bands` (usado en `ActiveDirectorSessionsBanner`). Es una **tercera instancia** de listener de Firestore innecesaria. Menos grave porque `bands` es una lista simétrica entre instancias (no depende de selección), pero igual viola la regla de "no instancias independientes de `useBands()`".

---

## Otras observaciones

- **Naming:** el plan especifica los hooks de acceso como `useUser()` y `useBand()`. El código expone `useUserContext()` y `useBandContext()`. No es un problema arquitectónico, pero conviene decidir si se estandariza el nombre (ajustar plan o código).
- **Tests / reglas Firestore:** no se incluyeron en el `.zip` provisto, por lo que no se pudo validar el criterio "Tests y reglas Firestore siguen funcionando". Si existen en otro repo o carpeta, se pueden revisar aparte.

---

## Impacto funcional concreto (no solo arquitectura)

- ❌ El banner global de Director Mode (`DirectorSessionBanner`) **nunca se muestra**, en ninguna pantalla.
- ❌ El seguimiento de Director Mode en la pantalla de canción (`app/song/[id].tsx`) **no funciona**.
- ⚠️ Cambiar de banda en la pantalla principal (`band/index.tsx`) puede **desincronizarse** con lo que ven `setlists/[id].tsx` y `setlists/index.tsx`.

Esto confirma que el criterio de terminado del plan — *"Director Mode y navegación funcionan correctamente al cambiar de banda"* — **todavía no se cumple**.

---

## Recomendación de orden de trabajo (pasos 6-7 del plan)

1. Migrar `app/(tabs)/band/index.tsx` para usar `useBandContext()` en vez de `useBands()` directo. (Mayor impacto/riesgo — es la pantalla de selección de banda.)
2. Eliminar `activeBandId` / `setActiveBandId` de `AppContext` por completo.
3. Actualizar `DirectorSessionBanner.tsx`, `app/song/[id].tsx` y `HomeScreen.tsx` para leer `activeBandId` / `bands` desde `useBandContext()`.
4. Grep final de `useBands()` y de `activeBandId` fuera de `BandContext.tsx` / `useBands.ts` para confirmar cero instancias sueltas.
5. Validar manualmente: cambiar de banda en `band/index.tsx` y confirmar que `setlists/[id].tsx`, el banner de Director Mode y `song/[id].tsx` reflejan el cambio inmediatamente.

---

## Archivos citados en este diagnóstico

- `src/context/AppContext.tsx`
- `src/context/BandContext.tsx`
- `src/context/UserContext.tsx`
- `src/hooks/useBands.ts`
- `src/hooks/useBandSetlists.ts`
- `src/hooks/useDirectorSession.ts`
- `app/(tabs)/band/index.tsx`
- `app/(tabs)/band/setlists/[id].tsx`
- `app/(tabs)/band/setlists/index.tsx`
- `src/screens/HomeScreen.tsx`
- `src/components/DirectorSessionBanner.tsx`
- `app/song/[id].tsx`
- `app/_layout.tsx`
