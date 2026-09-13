# Diagnóstico — Referencias a `activeSetlist`, `setlistSongs`, `handleStartSetlistLocally`, `handleFollowSongChange`

**Fecha:** 2026-09-07
**Alcance:** análisis estático del proyecto (`proyect.zip`), sin modificar archivos. Contexto: limpieza en curso de `AppContext.tsx` dentro de la refactorización arquitectónica (`UserContext` / `BandContext` / `AppContext`).

---

## 1. `activeSetlist`

| Archivo | Líneas | Tipo de referencia | Depende / consume desde |
|---|---|---|---|
| `src/context/AppContext.tsx` | 67 (tipo), 170 (`useState`), 207, 609, 616, 621, 640, 647, 663, 684, 702, 711, 742-743, 764, 787-788, 822, 1250 (export) | **Definición** del estado + lectura/escritura interna (helpers de setlists personales) | — |
| `src/components/SetlistModals.tsx` (`EditSetlistModal`) | 127 (destructure), 143-152, 184 | **Destructuring desde `useAppContext()`** + lectura | Modal de edición de setlist personal |
| `src/components/songViewer/SetlistNavSubHeader.tsx` | 38 (destructure), 51-55 | **Destructuring desde `useAppContext()`** + lectura | Sub-header de navegación del `SongViewer` — comentario propio del código: *"En modo personal seguimos usando `activeSetlist`"* |
| `app/(tabs)/setlists/[id].tsx` | 15 (destructure), 39-261 | **Destructuring desde `useAppContext()`** + lectura/escritura | Pantalla de detalle de setlist **personal** |
| `src/components/band/BandSetlistList.tsx` | 137, 471 | ⚠️ Falso positivo — key de estilo (`activeSetlistCard`), no el estado de contexto | — |
| `src/screens/SongsScreen.tsx` | 249, 261 | ⚠️ Falso positivo — keys de estilo (`activeSetlistHeader`, `activeSetlistTitle`) | — |

**Relación con Band / Director Mode:** indirecta. `SetlistNavSubHeader` es un componente **compartido** entre el flujo personal y el flujo de Band (se usa dentro de `SongViewer`, que se renderiza tanto en `app/song/[id].tsx` como en `app/setlist-player/[setlistId].tsx`). El propio código reconoce que `activeSetlist` solo aplica al "modo personal".

---

## 2. `setlistSongs`

Hay **tres fuentes distintas con el mismo nombre**, no sincronizadas entre sí.

| Archivo | Líneas | Tipo de referencia | Fuente real |
|---|---|---|---|
| `src/context/AppContext.tsx` | 69 (tipo), 167 (`useState`), 1252 (export) | **Definición** del estado global | `AppContext` (personal) |
| `app/song/[id].tsx` | 17 (destructure), 61-63, 95 | **Destructuring desde `useAppContext()`** + lectura, pasado como prop a `SongViewer` | `AppContext` (personal) |
| `src/components/SongViewer.tsx` | 69 (tipo), 115 (default `[]`), 660-661 | **Prop** (no lee contexto) | Recibe lo que le pase el padre |
| `src/components/songViewer/SetlistNavSubHeader.tsx` | 20 (tipo prop), 31, 44, 48, 145, 152, 156 | **Prop** (no lee contexto) | Recibe lo que le pase `SongViewer` |
| `app/setlist-player/[setlistId].tsx` | 1150 | **Prop calculada localmente** (`pages.map(page => page.song)`) | Local al componente — NO viene de `AppContext` ni de `BandContext` |
| `app/(tabs)/band/setlists/[id].tsx` | 203 (`useMemo`, definición local), 889, 891, 1240 | **Variable local** (mismo nombre, distinta fuente: `useMemo` sobre `setlist.songIds` + `songs` de `AppContext`) | Local a la pantalla de repertorio de Band |

### 🔴 Hallazgo crítico

`app/(tabs)/band/setlists/[id].tsx` usa `onSongPress={handleSongPress}` (línea 1241), función que viene de `useAppContext()`. La definición de `handleSongPress` en `AppContext.tsx` (línea 362 en adelante) **nunca llama a `setSetlistSongs`** — solo hace `setSongContent`, `setSelectedSong` y navega a `/song/[id]`.

**Consecuencia:** al tocar una canción desde el repertorio de una Banda, `app/song/[id].tsx` lee `setlistSongs` desde `AppContext`, que conserva el valor **anterior/stale** (del último setlist personal iniciado, o vacío) — no el repertorio real de la banda. El "siguiente/anterior" y el contador de `SetlistNavSubHeader` quedarían mostrando datos incorrectos en ese flujo.

`app/setlist-player/[setlistId].tsx`, en cambio, resuelve esto bien: calcula `setlistSongs` localmente (`pages.map(...)`) en vez de leerlo de `AppContext`.

---

## 3. `handleStartSetlistLocally`

| Archivo | Líneas | Tipo de referencia | Depende / consume desde |
|---|---|---|---|
| `src/context/AppContext.tsx` | 79 (tipo), 1036 (definición), 1258 (export) | **Definición** — agrupada bajo el comentario `// --- Director Mode helpers ---` | — |
| `src/screens/HomeScreen.tsx` | 41 (destructure), 380 (llamada) | **Destructuring desde `useAppContext()`** + **llamada** | Botón "Iniciar" sobre un setlist personal en el Home |
| `app/(tabs)/setlists/[id].tsx` | 23 (destructure), 144 (llamada con `activeSetlist`) | **Destructuring desde `useAppContext()`** + **llamada** | Pantalla de detalle de setlist personal |

**Relación con Band / Director Mode:** nominal, no real. El comentario del código la agrupa como "Director Mode helper", pero su implementación navega a `/setlist-player/[setlistId]` **sin** `bandId`, forzando `isBandMode = false`. Funcionalmente es 100% personal — el nombre/comentario es engañoso respecto a su alcance real.

---

## 4. `handleFollowSongChange`

| Archivo | Líneas | Tipo de referencia | Depende / consume desde |
|---|---|---|---|
| `src/context/AppContext.tsx` | 80 (tipo), 1071 (definición), 1259 (export) | **Definición**. Internamente busca la canción en `songs` (biblioteca local de `AppContext`), lee contenido/settings y hace `setSelectedSong`/`setSongContent` — no depende de `activeSetlist` ni de datos de Band | — |
| `app/setlist-player/[setlistId].tsx` | 54 (destructure), 720, 754 (dep array), 805, 824 (dep array) | **Destructuring desde `useAppContext()`** + **llamada** | Invocada dentro de dos `useEffect` que manejan explícitamente eventos de Director Mode (`activeSession`, `isDirector`, `followDirector`). Comentario del código: *"Actualizamos el estado global de la aplicación"* como reacción a un evento de sincronización del Follower |
| `app/song/[id].tsx` | 16 (destructure), 94 (pasado como prop `onFollowSongChange`, condicionado a `!isDirector`) | **Destructuring desde `useAppContext()`** + **paso condicional como prop** | Se activa específicamente cuando el usuario es Follower de una sesión de Band |

**Relación con Band / Director Mode:** **directa y confirmada.** Sincroniza el estado global de `AppContext` (canción seleccionada, contenido, settings) cuando un Follower recibe un evento `SONG_CHANGED`. Aunque vive en `AppContext`, su única razón de ser hoy es servir al flujo de Band/Director Mode — es lógica de Band "escondida" dentro de `AppContext`.

---

## Resumen y recomendación arquitectónica preliminar (sin modificar código)

| Elemento | Uso real | Recomendación |
|---|---|---|
| `activeSetlist` | 100% personal | Se queda en `AppContext`, tal como define la arquitectura objetivo. Sugerido a futuro: que `SetlistNavSubHeader` reciba `activeSetlist` también como prop (igual que ya recibe `setlistSongs`), para no depender implícitamente de `AppContext`. |
| `setlistSongs` | Mezcla de 3 fuentes con el mismo nombre; solo la de `AppContext` es realmente personal | Se queda en `AppContext` para el flujo personal. Pendiente de resolver: `handleSongPress`, cuando se invoca desde una pantalla de Band, no debería tocar el `setlistSongs` de `AppContext` — la pantalla de canción debería recibir el repertorio de Band por otra vía (prop o hook), igual que ya lo resuelve `setlist-player/[setlistId].tsx`. |
| `handleStartSetlistLocally` | 100% personal, pese al comentario que lo agrupa como "Director Mode" | Se queda en `AppContext`. Sugerido: corregir el comentario que lo agrupa erróneamente con Director Mode. |
| `handleFollowSongChange` | 100% ligado a Band/Director Mode (Follower) | Candidata clara para **salir de `AppContext`**. Su lugar natural sería junto a `useDirectorSession(activeBandId)` (o un hook derivado), ya que su única función es sincronizar la UI del Follower con eventos de Director Mode. |

---

## Archivos citados en este diagnóstico

- `src/context/AppContext.tsx`
- `src/components/SetlistModals.tsx`
- `src/components/songViewer/SetlistNavSubHeader.tsx`
- `src/components/SongViewer.tsx`
- `src/components/band/BandSetlistList.tsx`
- `src/screens/SongsScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `app/(tabs)/setlists/[id].tsx`
- `app/(tabs)/band/setlists/[id].tsx`
- `app/song/[id].tsx`
- `app/setlist-player/[setlistId].tsx`
