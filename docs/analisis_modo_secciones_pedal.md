# Modo "por secciones" del pedal Wi-Fi: análisis y plan de implementación

Proyecto revisado: `proyecto_1.zip` (app React Native + firmware ESP32 en `firmware/Pedal_shifter`).

Este documento tiene tres partes:

1. [Por qué el modo secciones se comporta mal](#1-por-qué-el-modo-secciones-se-comporta-mal): causas encontradas en el código.
2. [Nuevo protocolo con mensajes JSON](#2-nuevo-protocolo-mensajes-json): propuesta de reemplazo de los eventos sueltos.
3. [Resaltar la sección activa en el Song Viewer](#3-resaltar-la-sección-activa-en-el-song-viewer).

Al final hay un [orden de implementación](#4-orden-de-implementación-sugerido) y una [lista de pruebas](#5-pruebas-sugeridas).

---

## Resumen ejecutivo

El modo secciones no funciona bien porque **hay dos "dueños" de la posición que se pisan entre sí**:

- La **app** salta a la sección con `scrollTo` directo (`useSongSections`).
- El **ESP32** sigue manteniendo y transmitiendo su propia posición en líneas (`POS ...`), que la app sigue aplicando en modo secciones.

A eso se suman tres problemas más:

- **Los botones del firmware no emiten eventos en un toque corto.** Un toque corto no emite nada, y un doble toque emite `HOME`/`END`.
- **El índice de sección vive en el estado de React de cada dispositivo**, y se resetea solo.
- **El título de la canción cuenta como una sección.**

La solución propuesta es que el **ESP32 sea la única fuente de verdad también para las secciones**, y que envíe un mensaje JSON con la sección anterior, la actual y la siguiente, como pediste. Eso además deja un registro legible para depurar.

---

## 1. Por qué el modo secciones se comporta mal

### Hallazgo 1 (causa principal): el ESP32 sigue publicando `POS` y la app lo sigue aplicando

En `SongViewer.tsx` el efecto que escucha `onPosition` **no distingue el modo**:

```ts
// SongViewer.tsx (efecto "Posición publicada por el ESP32")
return onPosition(message => {
  if (!pedalEnabledRef.current) return;
  if (message.songKey !== songKeyRef.current) return;
  applyServerLinePos(message.pos, message.moving);   // ← también en modo 'sections'
});
```

Y en `useSongSections.scrollToSectionLine` el salto se hace así:

```ts
scrollRef.current?.scrollTo({ y: targetY, animated: true });
```

Ese `scrollTo` **no pasa por `applyLinePos`**, así que no actualiza `linePosRef`, `lineScrollYRef`, `scrollPosRef` ni `ignoreScrollUntilRef`. Para `useSongScroll` la posición "oficial" sigue siendo la vieja.

Lo que pasa, paso a paso:

1. Mantenés apretado el pulsador. A los 500 ms el firmware emite `DOWN_PRESS` y llama a `syncMotionStart(+1)`.
2. La app salta a la sección siguiente, con animación.
3. El ESP32 empieza a mover su posición a 2 líneas/seg y manda `POS ... moving=1` cada 250 ms.
4. Como en modo secciones no hay loop local de líneas (`linePedalRafRef.current === null`), `applyServerLinePos` cae en la rama final y llama `applyLinePos(pos, true)`. Eso hace **scroll animado a la posición del ESP32**, que es la vieja más un pequeño avance.
5. Resultado: la pantalla pelea entre "ir a la sección" y "volver a donde el ESP32 cree que estamos". Eso son los saltos que ves.

Además, al soltar llega un `POS moving=0` final con la posición del ESP32. Si ya habías saltado, la app **vuelve** hacia ahí. Ese es el "va y vuelve".

### Hallazgo 2: el firmware no emite eventos con un toque corto

`PedalButtons.cpp` implementa esta máquina de estados, igual para ARRIBA y ABAJO:

| Gesto | Qué emite el firmware |
|---|---|
| Toque corto (< `holdThresholdMs`, 500 ms por defecto) | **Nada.** Pasa a `WAITING_DOUBLE` y, si no hay segundo toque en `doublePressWindowMs`, vuelve a `IDLE`. |
| Mantener ≥ 500 ms | `UP_PRESS` / `DOWN_PRESS` (y al soltar, `*_RELEASE`). |
| Doble toque corto | `HOME` (arriba) o `END` (abajo). |

Esto choca con el modo secciones por dos motivos:

- **Un pulso no hace nada.** Para que la app reciba `DOWN_PRESS` hay que mantener apretado medio segundo. La idea "un pulso = una sección" no se cumple.
- **Dos toques rápidos = `END`.** Si tocás dos veces seguidas para avanzar dos secciones, el firmware manda `END` y la app hace `scrollToLinePos(Infinity)`: **va al final**. Después, un doble toque en ARRIBA manda `HOME` y vuelve al principio. Ese es el "va hacia el final y vuelve".

### Hallazgo 3: el índice de sección es estado local de React y se desincroniza

En `useSongSections.ts`:

```ts
const [currentSectionIndex, setCurrentSectionIndex] = useState(-1);
```

Problemas concretos:

1. **Se resetea solo al transponer o editar.** El `useEffect` depende de `sectionLineIndices`, que sale de un `useMemo` sobre `parsedLines`. `parsedLines` se recalcula cada vez que cambia `transposedContent` (ver `useSongContent.ts`). Cada transposición o edición deja el índice en `-1`, y el próximo pulso salta a la primera sección.
2. **`HOME` y `END` no actualizan el índice.** En `SongViewer.tsx`, `HOME` llama `scrollToLinePos(0)` y `END` llama `scrollToLinePos(Infinity)`, pero `currentSectionIndex` queda como estaba. Después de `END`, un pulso "siguiente" va a la sección N+1 desde donde estaba antes, no desde el final.
3. **No sigue al scroll manual.** Si deslizás con el dedo, el índice no cambia. El próximo pulso calcula desde un índice que ya no corresponde a lo que se ve.
4. **Lecturas viejas al pulsar rápido.** `jumpToNextSection` lee `currentSectionIndex` de la clausura. Si llegan dos eventos antes del siguiente render, los dos usan el mismo índice y saltan a la misma sección. Además, al cambiar el índice cambia la identidad de `jumpToNextSection`, de `handlePedalEvent` y se re-suscribe el listener (`onPedalEvent`), con una pequeña ventana donde se pueden perder eventos.
5. **Cada dispositivo tiene su propio índice.** Con varios teléfonos, cada uno cuenta por su cuenta. No hay una "sección actual" compartida, que es justo lo que da sentido al pedal Wi-Fi.

### Hallazgo 4: el título cuenta como una sección

En `chordpro.ts`, el título de la canción se emite como `{ type: 'section', blocks: [{ text: '[TITULO] ...' }] }`. `useSongSections` filtra solo por `line.type === 'section'`, así que **la sección 0 es el título**. El primer pulso "siguiente" va al título (que ya está arriba de todo) y parece que no pasó nada. También hay que decidir qué hacer con los comentarios `{comment: ...}` que se convierten en `section`.

### Hallazgo 5: las secciones cortas o las últimas no pueden quedar al 30 %

`targetY = sectionY - viewportHeight * 0.3` se recorta a `maxScroll`. Cuando la última sección es corta, la etiqueta queda más abajo del 30 %. No es un bug, pero conviene saberlo: el último salto no se va a ver igual que los demás. Y el índice dice "última sección" aunque el scroll no esté posicionado como en las otras.

### Hallazgo 6 (relacionado): secciones más largas que la pantalla

Con un pulso por sección, si una sección es más alta que el 70 % visible, **nunca se ve su final**. Es el problema que mencionaste al inicio. Con el diseño actual no hay forma de llegar ahí. Ver la opción de "sub-pasos" en [3.4](#34-opcional-secciones-largas).

### Resumen de causas

| # | Causa | Síntoma |
|---|---|---|
| 1 | La app aplica `POS` del ESP32 aun en modo secciones; el salto local no actualiza las referencias de posición | Saltos, vuelve a donde estaba |
| 2 | Toque corto no emite; doble toque emite `END`/`HOME` | No responde al pulso, o se va al final/principio |
| 3 | Índice local, se resetea al transponer, no sigue HOME/END ni el scroll manual | Salta a secciones "incorrectas" |
| 4 | El título cuenta como sección | Primer pulso "no hace nada" |
| 5/6 | Última sección y secciones largas | Posición distinta en la última; no se ve el final de secciones largas |

---

## 2. Nuevo protocolo: mensajes JSON

### 2.1 Idea general

En lugar de que la app reaccione a eventos sueltos (`DOWN_PRESS`, `UP_PRESS`...) y calcule por su cuenta, el ESP32 pasa a ser la **fuente de verdad de la navegación por secciones**, igual que ya lo es de la posición en líneas:

1. Cada app le informa al ESP32 **qué secciones tiene la canción** (cantidad y etiquetas, no hace falta más).
2. El ESP32 guarda por canción el **índice de sección activo**.
3. Cuando se pulsa el pedal, el ESP32 actualiza ese índice y **manda a todos los dispositivos un mensaje de estado** con la sección anterior, la actual y la siguiente.
4. Cada app traduce "sección N" a píxeles **con sus propias medidas** (como ya hace con las líneas) y se posiciona.

Así todos muestran la misma sección aunque tengan pantallas distintas, y no hay dos fuentes de posición compitiendo.

### 2.2 Formato

Se mantiene **una línea por mensaje terminada en `\n`** (lo que ya usa el protocolo), pero el payload pasa a ser JSON. Con una regla simple para que sea compatible con lo existente: **si la línea empieza con `{`, es JSON**; si no, se interpreta con el parser de texto actual (`HELLO`, `POS`, `CFG`, `MINV`, `UP_PRESS`, ...). Eso permite migrar de a poco y probar con el firmware viejo.

Todos los mensajes llevan:

- `t`: tipo de mensaje.
- `v`: versión del protocolo (empezar en `1`).
- `seq`: contador que incrementa el ESP32 en cada mensaje de estado (para detectar mensajes viejos o perdidos y para depurar).

#### Cliente → ESP32

**`hello`**: "abrí esta canción". Reemplaza al `HELLO` de texto. Agrega la lista de secciones.

```json
{"t":"hello","v":1,"song":"a1b2c3","visible":14,"total":86,"pos":0.0,
 "sections":[{"line":0,"label":"Intro"},{"line":6,"label":"Verso 1"},{"line":18,"label":"Coro"}]}
```

- `sections[].line` es el índice de línea lógica (`parsedLines`) de cada etiqueta, **sin incluir el título**.
- Todos los dispositivos que abren la misma canción (`song` = misma `songKey`) tienen que mandar la misma lista. Si difiere, el ESP32 se queda con la del primero y lo avisa en el log de diagnóstico.
- Se reenvía cuando cambia la pantalla o la letra, igual que hoy.

**`leave`**: `{"t":"leave","v":1,"song":"a1b2c3"}`.

#### ESP32 → cliente

**`cfg`**: reemplaza al `CFG` de texto y agrega el modo.

```json
{"t":"cfg","v":1,"mode":"sections","linesPerSec":2.0,"rampMs":150,"overlap":0.3}
```

- `mode`: `"lines"` o `"sections"`. Lo elige el usuario en la página web del pedal ([2.5](#25-selector-de-modo-en-la-página-web-del-pedal)) y el ESP32 lo reenvía a todos los dispositivos conectados cuando cambia.
- `overlap`: fracción del viewport que queda arriba de la sección (por defecto `0.3`). Que lo defina el ESP32 evita que cada teléfono tenga un valor distinto.

**`sec`**: estado de secciones. Es el mensaje clave.

```json
{"t":"sec","v":1,"seq":42,"song":"a1b2c3","cause":"next",
 "index":2,"count":5,
 "prev":{"index":1,"line":6,"label":"Verso 1"},
 "cur": {"index":2,"line":18,"label":"Coro"},
 "next":{"index":3,"line":30,"label":"Verso 2"}}
```

- `index`: sección activa (`-1` = antes de la primera, es decir, la zona del título/intro sin etiqueta).
- `prev` / `next` son `null` si no existen.
- `cause`: `"next"`, `"prev"`, `"home"`, `"end"`, `"join"`, `"resync"`, `"mode"`. Sirve para depurar y para que la app decida cómo animar (por ejemplo, sin animación en `join`).
- Se envía a **todos** los que tienen esa canción abierta, y **solo a quien se une** cuando alguien nuevo abre la canción (`cause:"join"`).

**`pos`**: sigue existiendo para el modo `lines`. En modo `sections` **el ESP32 no manda `pos` móvil**.

**`minv`**: puede quedar como está o pasarse a JSON con el mismo esquema:
`{"t":"minv","v":1,"song":"...","minVisible":9}`.

#### Eventos crudos del pedal (siguen existiendo, pero solo informativos)

Los eventos `UP_PRESS`, `DOWN_PRESS`, `HOME`, `END` por TCP **en modo `sections` ya no deben mover nada en la app**. Se pueden seguir enviando para el log de depuración, o pasar a un mensaje JSON `{"t":"btn","v":1,"btn":"down","kind":"tap"}`. Mientras el pedal use Bluetooth HID, los eventos de BT siguen siendo la única señal (ver [2.6](#26-bluetooth)).

### 2.3 Cambios en el firmware

#### a) `PedalSyncModel` (`PedalSyncModel.h/.cpp`)

Es la parte central. Todo sigue siendo independiente de Arduino y se puede probar en una PC.

1. **Guardar las secciones por canción.**

   ```cpp
   struct Section { uint16_t line; char label[24]; };
   struct Song {
     bool used; char key[KEY_MAX]; uint16_t total; float pos;
     uint8_t sectionCount;           // máx. 32
     Section sections[32];
     int8_t  sectionIndex;           // -1 = antes de la primera
     bool    hasSections;
   };
   ```

   Memoria: con 7 canciones × 32 secciones × 26 bytes ≈ 5,8 KB. Alcanza en un ESP32 y se puede bajar a 24 secciones si hace falta.

2. **Parsear JSON.** El firmware ya incluye `ArduinoJson` (se usa en `WebConfigServer`). Pero `PedalSyncModel` no depende de Arduino, así que hay dos caminos:
   - Parsear con `ArduinoJson` en `PedalSocketServer::readClients` y pasar al modelo una estructura ya armada (`onHelloJson(slot, HelloData&)`), manteniendo el modelo puro. **Recomendado**.
   - O escribir un parser mínimo. No vale la pena.

   El buffer de recepción por cliente es `RX_MAX = 128`. Un `hello` con 32 secciones mide ~1,5 KB. **Hay que subir `RX_MAX` a 2048** (son 7 × 2 KB = 14 KB de RAM, aceptable) y ajustar `RX_BYTES_PER_UPDATE`.

3. **Nuevas operaciones públicas:**

   ```cpp
   void sectionNext();     // índice+1, con tope
   void sectionPrev();     // índice-1, con tope (-1 = inicio)
   void sectionHome();     // índice = -1
   void sectionEnd();      // índice = count-1
   void setMode(Mode m);   // lines | sections
   ```

   Cada una modifica **todas las canciones abiertas** (como hoy `motionStart` mueve todas) y llama a `broadcastSection(key, cause)`.

4. **`broadcastSection(key, cause)`**: arma el JSON `sec` y lo manda con `sink_->sendToSlot` a todos los clientes que tengan esa canción. Es el equivalente a `broadcastMinVisible` que ya existe.

5. **Cuando alguien se une** (`handleHello` con `join`): enviar `cfg` + (según el modo) `pos` o `sec` con `cause:"join"`.

6. **Qué pasa si no hay secciones** (`sectionCount == 0`): en modo `sections` el ESP32 hace un *fallback* a "página": avanza `pos` en pasos de `visibleLines` mínimas (`minVisibleLines`) y manda `pos` con `moving:0`. Así el pedal no queda inerte en canciones sin etiquetas.

#### b) `PedalButtons` (`PedalButtons.cpp/.h`)

En modo `sections` la máquina de estados tiene que ser **más simple y sin esperas**:

| Gesto | Modo `lines` (actual) | Modo `sections` (nuevo) |
|---|---|---|
| Toque (flanco de bajada, ya con antirrebote) | espera 500 ms para decidir | **emite `*_TAP` inmediatamente** |
| Mantener | `*_PRESS` / `*_RELEASE` (scroll continuo) | ver nota |
| Doble toque | `HOME` / `END` | no se interpreta; son dos toques |

Notas:

- Agregar a `PedalEvent` los valores `UP_TAP` y `DOWN_TAP`.
- En modo `sections`, el **mantener** puede: (a) no hacer nada, (b) repetir el avance cada ~600 ms (útil para saltar varias secciones), o (c) mandar `HOME`/`END` al mantener ≥ 1,5 s. Sugerencia: (c), porque `HOME`/`END` ya no se pueden hacer con doble toque.
- `PedalButtons` necesita saber el modo: `buttons.setMode(config.mode)`, igual que hoy recibe `config` para los tiempos.

#### c) `PedalEventManager` (`PedalEventManager.cpp`)

En `handle()`:

```cpp
case PedalEvent::DOWN_TAP:
  logDelivery("DOWN_TAP\n");
  socketServer_->syncSectionNext();   // JSON "sec" a todos
  bluetooth_->write('2');             // ver 2.6
  break;
case PedalEvent::UP_TAP:
  socketServer_->syncSectionPrev();
  ...
```

Importante: **en modo `sections` no llamar a `syncMotionStart/Stop`**. Eso es lo que genera el `POS` que hoy pisa el salto.

#### d) `PedalConfig` (`PedalConfig.h/.cpp`)

Agregar y persistir en `Preferences`:

```cpp
enum class PedalMode : uint8_t { LINES = 0, SECTIONS = 1 };
struct PedalBehaviorConfig { PedalMode mode; uint8_t overlapPercent; }; // 0..60
```

con `clamp()`, `save()`, `reset()` y el log por Serial, siguiendo el patrón de los campos existentes.

### 2.4 Cambios en la app

#### a) `WifiPedalAdapter.ts` y tipos (`types/pedal.ts`)

- `handleLine(value)`: si `value.startsWith('{')`, hacer `JSON.parse` dentro de `try/catch` y despachar por `msg.t` (`cfg`, `sec`, `pos`, `minv`). Si falla el parseo, registrar en `DebugLogger` y seguir. Si no empieza con `{`, usa el parser de texto actual.
- Nuevos tipos:

  ```ts
  export interface WifiSectionRef { index: number; line: number; label: string }
  export interface WifiSectionState {
    seq: number; songKey: string; cause: string;
    index: number; count: number;
    prev: WifiSectionRef | null; cur: WifiSectionRef | null; next: WifiSectionRef | null;
  }
  export interface WifiConfigMessage {
    mode: 'lines' | 'sections'; linesPerSec: number; rampMs: number; overlap: number;
  }
  ```

- Nuevo listener `onSection(listener)`, expuesto igual que los otros en `PedalService` y `usePedal`.
- `sendHello` pasa a mandar JSON y agrega `sections`.

#### b) `useSongSections.ts`: se simplifica mucho

El hook **deja de decidir** a qué sección ir. Pasa a ser:

```ts
const sections = useMemo(() =>
  parsedLines.reduce<{line:number; label:string}[]>((acc, l, i) => {
    if (l.type === 'section' && !isTitleLine(l)) acc.push({ line: i, label: cleanLabel(l) });
    return acc;
  }, []), [parsedLines]);
```

- **Excluir el título** (`[TITULO]`) con la misma lógica que ya usa `SongContent`. Mejor mover `isTitleLine` a `utils/` y usarla en ambos lados.
- Exportar `sections` para enviarlas en el `hello`.
- `scrollToSection(lineIndex, animated)`: calcula `y` con la fórmula que ya existe **pero pasando por un único punto de entrada de `useSongScroll`** (ver siguiente punto), no con `scrollRef.scrollTo` directo.
- **Se elimina `currentSectionIndex` como estado local** de decisión. El índice activo lo dicta el mensaje `sec` y vive en estado de `SongViewer` solo para pintar la UI (resaltado, etiqueta en el info bar).

#### c) `useSongScroll.ts`: un solo punto de entrada para scroll por secciones

Agregar `applySectionScroll(lineIndex, overlapFraction, animated)` junto a `applyLinePos`, que **actualice las mismas referencias** (`linePosRef`, `lineScrollYRef`, `scrollPosRef`, `ignoreScrollUntilRef`) y llame al `scrollTo`. Así `getTrustedLinePos()` sigue siendo coherente y la app no se contradice con el scroll recién hecho.

Cálculo:

```ts
const sectionTop = getTops()[lineIndex];
const targetY = clamp(sectionTop - viewportHeight * overlap, 0, getMaxScroll());
// la "posición en líneas" equivalente = yToPos(tops, targetY + viewportHeight * LINE_ANCHOR_FRACTION)
```

Hay que **guardar `linePosRef` con la posición equivalente en líneas** del `targetY` real (no con el índice de línea). Así, si el usuario vuelve al modo `lines`, la app arranca desde donde está.

#### d) `SongViewer.tsx`

1. **Elegir la ruta según el modo que manda el ESP32** (`cfg.mode`), no según un estado local del teléfono. Para Bluetooth (sin ESP32 por Wi-Fi) se mantiene la elección local.
2. En el efecto de `onPosition`: `if (pedalModeRef.current === 'sections') return;` mientras el ESP32 no mande `pos` en ese modo. Defensa extra por si llega uno viejo.
3. Nuevo efecto: `onSection(msg => { if (msg.songKey !== songKeyRef.current) return; setActiveSection(msg.cur); applySectionScroll(msg.cur.line, overlap, msg.cause !== 'join'); })`.
4. En `handlePedalEvent`, en modo `sections` **ignorar los eventos de origen `wifi`** (el movimiento viene en `sec`). Dejar el comportamiento actual solo para `source === 'bluetooth'`.
5. Reenviar `hello` cuando cambia `sections` (por ejemplo, al editar la letra), igual que ya se hace con `lineMapVersion`.
6. Quitar el `useEffect` que resetea el índice por `[songId, currentContent]`. Ya no hace falta.

#### e) Selector de modo

`PedalConfigModal.tsx` y `SongViewerInfoBar.tsx` ya tienen el selector. Con el nuevo diseño hay dos opciones:

- **Recomendada**: que el modo **se elija en la página web del pedal** ([2.5](#25-selector-de-modo-en-la-página-web-del-pedal)) y la app solo lo muestre (etiqueta "⊞ Secciones" en el botón del pedal) porque lo recibe en `cfg`. Si el modo lo fijara cada teléfono, un dispositivo en `sections` y otro en `lines` verían cosas distintas con el mismo pedal.
- Alternativa: dejar el selector en la app y que mande un mensaje `{"t":"setmode","mode":"sections"}` al ESP32, que lo guarda y lo reenvía a todos.

### 2.5 Selector de modo en la página web del pedal

En `WebPages.cpp`, en la tarjeta "Comportamiento", agregar:

```html
<label>Modo del pedal</label>
<select id="mode">
  <option value="lines">Scroll por líneas</option>
  <option value="sections">Salto por secciones</option>
</select>
<label>Contexto de la sección anterior (%)</label>
<input id="overlap" type="number" min="0" max="60" value="30">
```

- `WebPages::dashboard(...)` recibe `mode` y `overlapPercent` para preseleccionar los valores.
- `saveTiming()` incluye `mode` y `overlapPercent` en el `POST /api/config`.
- `WebConfigServer::handleConfig()` los lee (`readUInt`/`readString`), llama a `config.clamp()` y `config.save()`, y luego a `socketServer_->setMode(...)`, que reenvía `cfg` a todos los clientes **sin reiniciar**.
- `handleStatus()` / `jsonStatus()` agregan `"mode"` para mostrarlo en el panel.
- Agregar `mode`, `sectionIndex` y `seq` a la página `/diagnostico` ([2.7](#27-depuración)).

### 2.6 Bluetooth

El pedal Bluetooth HID solo manda teclas (`'1'`, `'2'`, `'h'`, `'e'`). No lleva JSON ni sincroniza varios dispositivos. Propuesta:

- En modo `sections`, enviar **una sola tecla por toque** (`'1'` / `'2'` en el flanco), sin `press`/`release` largo.
- La app, con origen `bluetooth` y modo `sections`, hace el salto **local**: se calcula el índice a partir de la **posición actual** (ver abajo) en vez de uno guardado. Es el único caso donde la app decide.
- Cálculo local robusto: la sección actual es la última cuya `line` es ≤ `yToPos(tops, scrollY + viewportHeight * overlap)`. Así sigue funcionando después de un scroll manual, una transposición o un `HOME`/`END`.

### 2.7 Depuración

Lo que pediste: que sirva para depurar. Con este diseño se puede:

1. **Log de diagnóstico del firmware**: cada `sec` enviado queda en `PedalDiag` con `seq`, `cause`, `index/count` y cuántos clientes lo recibieron. La página `/diagnostico` ya muestra el registro de eventos; solo agregar la categoría `SEC`.
2. **Log de la app** (`DebugLogger`): cada `sec` recibido y cada `applySectionScroll` con `seq`, `line`, `targetY`, `viewportHeight` y `maxScroll`. Si el `seq` salta (ej. 41 → 43), se perdió un mensaje y se puede pedir un `resync`.
3. **Mensaje `resync`**: cliente → ESP32 `{"t":"resync","v":1,"song":"..."}`. El ESP32 responde con el `sec` actual (`cause:"resync"`). Útil al volver a primer plano o si el `seq` no es consecutivo.
4. **Panel de depuración** (`DebugPanel.tsx`, que ya existe): mostrar modo, `index/count`, `label` actual, `seq` y los últimos 20 mensajes JSON crudos.

---

## 3. Resaltar la sección activa en el Song Viewer

### 3.1 Qué se muestra

Cuando el pedal Wi-Fi está conectado y la canción está sincronizada (`syncWithPedal`), la app **enfoca la sección activa**:

- **Barra lateral** de color a la izquierda de todo el bloque de la sección (desde su etiqueta hasta la línea anterior a la siguiente etiqueta).
- **Fondo tenue** en ese bloque.
- **Atenuado leve** (`opacity ≈ 0.55`) en el resto de la canción, para que el ojo vaya al bloque activo.
- Se aplica **tanto en modo `sections` como en `lines`**: en `lines` la "sección activa" es la que contiene la línea del punto de anclaje (`yToPos(...)`), que se puede calcular localmente.

Todo con transición corta (~150 ms) para que no parpadee.

### 3.2 Cómo se implementa

**1. Calcular el rango de líneas de la sección activa** (en `useSongSections`):

```ts
// sections[i] = { line, label }
const activeRange = useMemo(() => {
  if (activeIndex < 0 || activeIndex >= sections.length) return null;
  const start = sections[activeIndex].line;
  const end = (sections[activeIndex + 1]?.line ?? parsedLines.length) - 1;
  return { start, end };
}, [activeIndex, sections, parsedLines.length]);
```

**2. Qué índice es el activo:**

- Modo `sections`: el `index` del mensaje `sec`.
- Modo `lines`: la última sección cuya `line` es ≤ `Math.floor(getLinePos())`. Se recalcula en `onScroll` con el mismo throttling que ya usa `updateSharedLimit` (solo actualizar el estado cuando cambia el índice, para no re-renderizar en cada frame).

**3. Pasar el rango a `SongContent`** (`SongContent.tsx`):

```ts
interface SongContentProps {
  ...
  /** Rango de líneas de la sección enfocada (null = sin enfoque). */
  activeRange?: { start: number; end: number } | null;
}
```

En el `map` de `parsedLines`, para cada `lIndex`:

```tsx
const inActive = !!activeRange && lIndex >= activeRange.start && lIndex <= activeRange.end;
const dim = !!activeRange && !inActive;

<View
  key={lIndex}
  onLayout={...}
  style={[
    dim && { opacity: 0.55 },
    inActive && styles.activeSectionLine,   // borderLeftWidth: 3, borderLeftColor: acento, fondo tenue
  ]}
>
```

Importante: **no cambiar el alto de las líneas** (usar `borderLeftWidth` con `paddingLeft` compensado, o un `View` absoluto). Si cambia el alto, cambia `onLayout`, se reconstruye `tops` y se dispara un `hello` nuevo.

**4. Alternativa más barata** (si el re-render de todas las líneas pesa): dibujar **un único recuadro absoluto** detrás del contenido, con `top = tops[start]`, `height = tops[end + 1] - tops[start]` (en coordenadas del contenedor de la canción). Como `tops` ya existe, es un solo `View` con `pointerEvents="none"` y no toca las líneas. Se puede combinar con un atenuado suave solo por encima y por debajo. **Recomendada** si la canción es larga.

**5. Etiqueta en el info bar:** mostrar el nombre de la sección activa (`currentSectionLabel`, que ya está implementado) en `SongViewerInfoBar`, p. ej. `Coro · 3/5`.

### 3.3 Tema y accesibilidad

- Color del acento: usar `theme.chords` o el amarillo `#fbbf24` que ya usan las etiquetas de sección en modo escenario.
- No depender solo del color: la barra lateral y el atenuado dan dos señales distintas.
- Opción para apagarlo en el modal de configuración del pedal ("Resaltar sección activa").

### 3.4 (Opcional) secciones largas

Para el problema de secciones más altas que la pantalla ([Hallazgo 6](#hallazgo-6-relacionado-secciones-más-largas-que-la-pantalla)), dos alternativas:

- **Sub-pasos automáticos.** Si la altura de la sección supera `viewportHeight * (1 - overlap)`, el ESP32 le suma "sub-pasos": cada toque avanza `visibleLines * 0.7` líneas dentro de la sección antes de pasar a la siguiente. Hace falta que el `hello` incluya la **cantidad de líneas** de cada sección (`len`), y que el mínimo de líneas visibles entre dispositivos (`minVisible`, que el ESP32 ya calcula) fije el tamaño del paso para que **todos** vean el final.
- **Doble función del pedal.** Toque = siguiente sección. Mantener = avanzar por líneas dentro de la sección (el modo actual de `lines`).

Ninguna es necesaria para arreglar el comportamiento actual; conviene decidirlo después de probar el modo con canciones reales.

---

## 4. Orden de implementación sugerido

El orden minimiza el tiempo con la app rota y permite probar cada paso.

| Paso | Qué | Dónde | Cómo se prueba |
|---|---|---|---|
| 1 | **Arreglo rápido de la causa principal**: en modo `sections`, ignorar `POS` del ESP32 y hacer que el salto pase por un único punto de entrada de `useSongScroll` (`applySectionScroll`) | App: `SongViewer.tsx`, `useSongScroll.ts`, `useSongSections.ts` | Mantener ABAJO ≥ 500 ms: salta una vez y no vuelve |
| 2 | Excluir el título; calcular la sección actual desde la posición, no desde un índice guardado | App: `useSongSections.ts`, `SongContent.tsx` (mover `isTitleLine`) | Transponer y pulsar: sigue desde donde estaba |
| 3 | **Resaltado de la sección activa** (sección 3 de este documento) | App: `SongContent.tsx`, `SongViewer.tsx`, `SongViewerInfoBar.tsx` | Visual; funciona con los pasos 1 y 2 sin tocar el firmware |
| 4 | `PedalConfig`: modo y overlap persistidos; selector en la web | Firmware: `PedalConfig.*`, `WebPages.*`, `WebConfigServer.*` | Cambiar el modo en la web, reiniciar, ver que se conserva |
| 5 | `PedalButtons`: `*_TAP` inmediato en modo `sections` | Firmware: `PedalButtons.*`, `PedalEventManager.cpp` | Un toque corto = un evento en `/diagnostico` |
| 6 | `PedalSyncModel`: secciones por canción, `sectionNext/Prev/Home/End`, `broadcastSection` | Firmware: `PedalSyncModel.*`, `PedalSocketServer.*` | **Test en PC** (ya existe el patrón con `g++`): dos clientes, varios toques, ver los `sec` |
| 7 | App: parser JSON, `onSection`, `hello` con secciones, `cfg.mode` | App: `WifiPedalAdapter.ts`, `PedalService.ts`, `usePedal.ts`, `types/pedal.ts`, `SongViewer.tsx` | Dos dispositivos con pantallas distintas ven la misma sección |
| 8 | Depuración: categoría `SEC` en diagnóstico, `seq`, `resync`, panel en la app | Firmware: `PedalDiag`, `DiagJson`, `DiagPage`; App: `DebugPanel.tsx` | Desconectar un teléfono y reconectar: se resincroniza |
| 9 | Bluetooth en modo secciones (salto local desde la posición) | App: `SongViewer.tsx` | Pedal BT sin Wi-Fi: un toque = una sección |
| 10 | (Opcional) sub-pasos para secciones largas | Ambos | Canción con un verso más alto que la pantalla |

Los pasos **1 a 3** son solo de la app y deberían arreglar el comportamiento más visible. Los pasos **4 a 8** son el cambio de protocolo.

---

## 5. Pruebas sugeridas

### Firmware (en PC, sin hardware)

Seguir el patrón del test que ya se hizo para `MINV`: compilar `PedalSyncModel.cpp` con `g++` y un `ISyncSink` que imprima. Casos:

1. Un cliente abre una canción con 5 secciones: recibe `cfg` y `sec` con `cause:"join"`, `index:-1`.
2. `sectionNext()` ×3: `index` 0, 1, 2; `prev/cur/next` correctos en cada uno.
3. `sectionNext()` pasado el final: el `index` no se pasa de `count-1`.
4. `sectionPrev()` desde el índice 0: pasa a `-1`.
5. `sectionHome()` / `sectionEnd()`.
6. Dos clientes con la misma canción: ambos reciben cada `sec`; uno con otra canción no recibe nada.
7. Un tercer cliente se une a mitad de canción: recibe el `sec` vigente.
8. Un cliente manda `hello` con distinta lista de secciones: se mantiene la primera y se registra el aviso.
9. `hello` con más de 32 secciones: se recorta sin romper.
10. JSON mal formado o truncado: se ignora, sin reiniciar ni bloquear.
11. Sin secciones en modo `sections`: usa el *fallback* por página.

### Botones (firmware real)

- Un toque corto en modo `sections` genera exactamente **un** `*_TAP`, sin esperar la ventana de doble toque.
- Dos toques rápidos generan **dos** `*_TAP` y **ningún** `END`/`HOME`.
- El antirrebote no duplica eventos (mirar `/diagnostico`, que ya muestra los flancos).
- En modo `lines` el comportamiento actual no cambia.

### App

- Con dos dispositivos de tamaños distintos, un toque lleva a ambos a la misma sección (cada uno con su propio píxel).
- Transponer, cambiar el tamaño de letra o editar la canción **no** cambia la sección activa.
- `HOME`/`END` actualizan la sección activa.
- Scroll manual con el dedo en modo `sections`: el resaltado sigue la posición, y el próximo toque va a la siguiente respecto de lo que se ve.
- El resaltado no cambia la altura de las líneas (verificar que no se dispara un `hello` nuevo al activarlo).
- Primer pulso en una canción con título: va a la **primera sección real**, no al título.
- Canción sin secciones: el pedal sigue haciendo algo útil (página).
- Un mensaje `sec` con `seq` atrasado se descarta; con `seq` adelantado se pide `resync`.

---

## Apéndice: archivos a tocar

**App** (`src/`)

- `hooks/useSongSections.ts`: simplificar; excluir título; exponer `sections` y `activeRange`.
- `hooks/useSongScroll.ts`: agregar `applySectionScroll`.
- `components/SongViewer.tsx`: rutas por modo, efecto `onSection`, ignorar `POS` en modo `sections`, resaltado.
- `components/songViewer/SongContent.tsx`: prop `activeRange`; extraer `isTitleLine`.
- `components/songViewer/SongViewerInfoBar.tsx` y `PedalConfigModal.tsx`: mostrar el modo recibido y la sección activa.
- `services/pedal/WifiPedalAdapter.ts`, `services/PedalService.ts`, `hooks/usePedal.ts`, `types/pedal.ts`: parser JSON y tipos nuevos.
- `components/DebugPanel.tsx`: mensajes `sec` y `seq`.

**Firmware** (`firmware/Pedal_shifter/src/`)

- `PedalSyncModel.h/.cpp`: secciones, `sectionNext/Prev/Home/End`, `broadcastSection`, modo.
- `network/PedalSocketServer.h/.cpp`: parseo JSON, `RX_MAX` mayor, `syncSection*`, `setMode`.
- `input/PedalButtons.h/.cpp`: `UP_TAP` / `DOWN_TAP` y modo.
- `output/PedalEventManager.cpp`: despacho según el modo.
- `config/PedalConfig.h/.cpp`: `mode` y `overlapPercent`.
- `web/WebPages.*`, `web/WebConfigServer.*`: selector de modo.
- `diag/*`: categoría `SEC` y campos nuevos en `/diagnostico`.
