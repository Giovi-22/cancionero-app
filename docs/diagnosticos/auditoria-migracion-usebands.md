# Auditoría — Migración `useBands.ts` → `BandContext.tsx`

**Fecha:** 2026-09-08
**Alcance:** análisis estático del proyecto (`app.zip`), sin modificar archivos. Contexto: verificar que `BandContext` sea la única fuente de verdad global de Banda y que la migración desde `useBands()` haya quedado completa.

---

## A) Estado actual de la arquitectura

La migración está **completa y bien resuelta**. Hallazgos principales:

- **`src/hooks/useBands.ts` ya no existe como archivo** en el proyecto. No es que quedó sin usar — fue eliminado físicamente.
- **`BandContext.tsx` no depende de ningún hook `useBands()`**: su estado (`userBandsInfo`, `selectedBand`, `userRole`, `members`, `loading`, `error`) y sus efectos (`loadBands`, suscripción a `subscribeToUserBands`, suscripción a `subscribeToBandMembers`) están **inlineados directamente en el provider**, consumiendo `BandService` y `UserService`. Es una única fuente de estado, sin instancias paralelas.
- **`AppContext.tsx` no tiene ninguna referencia** a `selectedBand`, `activeBandId`, `userRole` ni `permissions` de banda (verificado con grep exhaustivo sobre todo el archivo — cero resultados). Ya no es fuente de verdad de banda.
- **Orden de providers correcto** en `app/_layout.tsx`: `UserContextProvider` → `BandContextProvider` → `DebugContextProvider` → `AppContextProvider`. El banner global de Director Mode (`GlobalDirectorBanner` → `DirectorSessionBanner`) se renderiza **dentro** de `BandContextProvider`, por lo que puede consumir `useBandContext()` sin problema.
- **No hay Services que importen Contexts** (dirección de dependencia correcta: los Services son agnósticos de React/Context).
- Los hooks especializados (`useDirectorSession`, `useBandSetlists`, `useBandInvitations`) están parametrizados externamente por `bandId`/`userId` y no mantienen ni recrean estado de banda por su cuenta.

---

## B) Archivos que consumen correctamente `useBandContext()`

| Archivo | Detalle |
|---|---|
| `app/(tabs)/band/index.tsx` | Destructura `selectedBand`, `userRole`, `permissions`, etc. desde `useBandContext()`. Incluye comentario explícito documentando que antes usaba `useBands()` directo. |
| `app/(tabs)/band/setlists/[id].tsx` | Destructura `selectedBand`, `permissions`; deriva `activeBandId = selectedBand?.id ?? null` localmente y lo pasa a `useBandSetlists`/`useDirectorSession`. Patrón correcto. |
| `app/(tabs)/band/setlists/index.tsx` | Mismo patrón: `selectedBand` → `bandId`/`activeBand` derivados localmente. |
| `app/song/[id].tsx` | `const { selectedBand } = useBandContext(); const activeBandId = selectedBand?.id ?? null;` — reemplaza correctamente lo que antes leía de `AppContext`. |
| `src/components/DirectorSessionBanner.tsx` | Igual patrón: `selectedBand` de `BandContext` → `activeBandId` derivado. Ya no depende de `AppContext` para esto. |
| `src/components/band/BandSongSelector.tsx` | `selectedBand` de `BandContext` → `activeBandId` derivado, usado en `useBandSetlists`. |
| `src/screens/HomeScreen.tsx` | `const { bands } = useBandContext();` — ya no llama `useBands()` propio. |

---

## C) Archivos que todavía usan arquitectura antigua

**Ninguno funcional.** Las únicas coincidencias de la cadena `useBands` fuera de lo ya migrado son **dos comentarios de texto** (no código ejecutable):

- `app/(tabs)/band/index.tsx:61` — `// Antes esta pantalla usaba useBands() directamente, lo que...`
- `app/(tabs)/band/setlists/[id].tsx:111` — `* useBands() se instancia únicamente dentro de BandContextProvider.`

No hay ningún `import` que apunte a `hooks/useBands` (confirmado con grep sobre todo el proyecto), así que estos comentarios no representan un riesgo de build, solo son referencias documentales desactualizadas ahora que el archivo fue eliminado.

---

## D) Posibles estados duplicados o fuentes de verdad paralelas

No se encontró ninguna. Específicamente se verificó:

- **Componentes de Band presentacionales** (`BandMemberList`, `BandSetlistList`, `CreateBandModal`, `CreateBandSetlistModal`, `InviteMemberModal`, `PendingInvitationsList`, `SentInvitationsList`, `ActiveDirectorSessionsBanner`) — **ninguno llama a un Context propio**; reciben todo por props desde sus pantallas padre. Esto es correcto según el plan ("Screens/components: presentación y coordinación").
- **`useState` con nombres relacionados a banda** fuera de `BandContext.tsx` — solo aparecen `selectedMember` (selección de UI local en `BandMemberList`, no es banda) y `BandSetlist` (estado de repertorio, no de banda activa). Ninguno duplica `selectedBand`/`userRole`/`permissions`.
- **Hooks especializados** (`useDirectorSession`, `useBandSetlists`, `useBandInvitations`) — no hacen fetch de bandas ni mantienen su propia lista/selección de banda; reciben `bandId` como parámetro.
- El único hit de `"permissions"` fuera de banda es en `DriveService.ts`, y corresponde a permisos de la API de Google Drive — no tiene relación con `BandPermissions`.

---

## E) Problemas arquitectónicos encontrados

- **Ninguno crítico ni funcional.**
- Único hallazgo (menor, cosmético): los **dos comentarios residuales** que mencionan `useBands()` (detallados en el punto C) quedaron desactualizados porque el archivo ya no existe. No rompen nada, pero pueden confundir a quien lea el código pensando que `useBands()` sigue siendo un patrón vigente en el proyecto.

---

## F) Cambios recomendados, ordenados por prioridad

1. **(Baja prioridad / cosmético)** Actualizar o eliminar los dos comentarios que mencionan `useBands()` en `app/(tabs)/band/index.tsx:61` y `app/(tabs)/band/setlists/[id].tsx:111`, ya que el hook fue eliminado y el comentario podría inducir a error a futuro.
2. No hay más cambios necesarios — no hay estado duplicado, no hay pantallas con arquitectura vieja, no hay ciclos entre Contexts/Hooks/Services.

---

## G) Confirmación final sobre `useBands.ts`

**`useBands.ts` ya no existe en el proyecto** — no es que "pueda" eliminarse, ya fue eliminado, y no quedó ningún import roto ni referencia de código a él. La migración hacia `BandContext` está **completa y consistente** en todas las pantallas y componentes relacionados con Banda, Repertorios/Setlists, Members, Band detail (cubierto por `band/index.tsx`, no hay pantalla separada) y Director Mode.

---

## Archivos revisados en esta auditoría

- `src/context/BandContext.tsx`
- `src/context/AppContext.tsx`
- `src/context/UserContext.tsx`
- `app/_layout.tsx`
- `app/(tabs)/band/index.tsx`
- `app/(tabs)/band/setlists/[id].tsx`
- `app/(tabs)/band/setlists/index.tsx`
- `app/song/[id].tsx`
- `src/components/DirectorSessionBanner.tsx`
- `src/components/band/BandSongSelector.tsx`
- `src/components/band/BandMemberList.tsx`
- `src/components/band/BandSetlistList.tsx`
- `src/components/band/CreateBandModal.tsx`
- `src/components/band/CreateBandSetlistModal.tsx`
- `src/components/band/InviteMemberModal.tsx`
- `src/components/band/PendingInvitationsList.tsx`
- `src/components/band/SentInvitationsList.tsx`
- `src/components/band/ActiveDirectorSessionsBanner.tsx`
- `src/screens/HomeScreen.tsx`
- `src/hooks/useDirectorSession.ts`
- `src/hooks/useBandSetlists.ts`
- `src/hooks/useBandInvitations.ts`
- `src/services/DriveService.ts`
