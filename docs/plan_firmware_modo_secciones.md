# Plan de cambios del firmware: modo "por secciones"

Proyecto: `firmware/Pedal_shifter` (ESP32, PlatformIO, framework Arduino) del `proyecto_1.zip`.

Este documento describe **qué voy a cambiar en el firmware, en qué archivo, por qué y cómo lo voy a probar**. Todavía no escribí nada de esto. Está pensado para que lo revises y me digas qué cambiarías antes de empezar.

Complementa a `analisis_modo_secciones_pedal.md` (el análisis de la app y la propuesta de protocolo). Acá se baja todo al código real del firmware.

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Punto de partida: lo que hace hoy el firmware](#2-punto-de-partida-lo-que-hace-hoy-el-firmware)
3. [Decisiones de diseño](#3-decisiones-de-diseño)
4. [Fases de implementación](#4-fases-de-implementación)
5. [Detalle por archivo](#5-detalle-por-archivo)
6. [Especificación del protocolo v1](#6-especificación-del-protocolo-v1)
7. [Memoria, tiempos y límites](#7-memoria-tiempos-y-límites)
8. [Diagnóstico y depuración](#8-diagnóstico-y-depuración)
9. [Plan de pruebas](#9-plan-de-pruebas)
10. [Qué tiene que cambiar la app en cada fase](#10-qué-tiene-que-cambiar-la-app-en-cada-fase)
11. [Riesgos y decisiones que necesito de vos](#11-riesgos-y-decisiones-que-necesito-de-vos)
12. [Entregables y orden de entrega](#12-entregables-y-orden-de-entrega)

---

## 1. Objetivo y alcance

### Lo que se quiere lograr

- **Elegir el modo del pedal desde la página web del pedal**: "Scroll por líneas" (el actual) o "Salto por secciones".
- En modo secciones, **un toque corto = una sección**, de forma inmediata y sin esperar ventanas de doble toque.
- Que el **ESP32 sea la única fuente de verdad** de la sección activa de cada canción, igual que ya lo es de la posición en líneas. Todos los dispositivos con la misma canción ven la misma sección.
- Que el ESP32 mande a las apps **mensajes JSON** con la sección anterior, la actual y la siguiente, y que esos mensajes sirvan para depurar.
- Que todo quede visible en `/diagnostico`.

### Lo que NO se toca

- **El modo líneas queda idéntico.** Mismos eventos, mismos mensajes de texto, mismos tiempos. Es el modo por defecto, así que un pedal recién actualizado se comporta como hoy hasta que se cambie el modo.
- El descubrimiento UDP (puerto 4444), el portal cautivo, la gestión de WiFi, el OTA y el afinador.
- El reset de WiFi con ambos botones (se respeta y se protege, ver [5.3](#53-inputpedalbuttonsh--cpp)).
- El protocolo de texto actual (`HELLO`, `LEAVE`, `CFG`, `POS`, `MINV`). Una app vieja sigue funcionando.

---

## 2. Punto de partida: lo que hace hoy el firmware

Esto es lo que verifiqué leyendo el código. Cada punto condiciona el diseño.

### 2.1 Los botones no emiten nada en un toque corto

`PedalButtons.cpp`, máquina de estados `IDLE → FIRST_PRESS → WAITING_DOUBLE → SECOND_PRESS → SCROLLING`:

| Gesto | Qué pasa |
|---|---|
| Toque corto (< `holdThresholdMs`, 500 ms) | Pasa a `WAITING_DOUBLE`. Si no hay segundo toque en `doublePressWindowMs` (500 ms), vuelve a `IDLE` **sin emitir nada**. |
| Mantener ≥ 500 ms | Emite `UP_PRESS` / `DOWN_PRESS`; al soltar, `*_RELEASE`. |
| Doble toque corto | Emite `HOME` (arriba) / `END` (abajo). |

Consecuencia: en modo secciones, "un pulso = una sección" **no se puede cumplir** sin cambiar esta lógica. Y dos toques rápidos se interpretan como `HOME`/`END`.

### 2.2 `PRESS` arranca el movimiento compartido

`PedalEventManager::handle()`: cada `UP_PRESS`/`DOWN_PRESS` llama a `socketServer_->syncMotionStart(±1)`. Eso activa el modelo cinemático de `PedalSyncModel`, que mueve la posición a 2 líneas/seg y manda `POS ... moving=1` cada 250 ms (`POS_INTERVAL_MS`). En modo secciones eso **no debe pasar**: es lo que hoy le pisa el scroll a la app.

### 2.3 El modelo de sincronización es global y no conoce secciones

`PedalSyncModel`:

- Tiene **una sola** variable de movimiento (`active_`, `dir_`, `vel_`, `target_`) que se aplica **a todas las canciones abiertas** (`update()` recorre `songs_[]`). `goHome()` y `goEnd()` también.
- `Song` guarda `key`, `total` y `pos`. No guarda ninguna lista de secciones.
- `ClientInfo` guarda `key`, `visible`, `total`. No sabe qué "versión" del protocolo habla cada cliente.
- Parser de texto: `onClientLine()` copia la línea a un `char buffer[128]` y despacha `HELLO` / `LEAVE`. Cualquier otra cosa se ignora.
- Es independiente de Arduino y se prueba en PC (`test/test_sync.cpp`). **Quiero conservar esa propiedad.**

### 2.4 Límites de recepción

`PedalSocketServer.h`: `RX_MAX = 128` bytes por línea y por cliente, `RX_BYTES_PER_UPDATE = 256` bytes por cliente por vuelta del `loop()`. Una línea más larga se descarta con el aviso "línea demasiado larga". Un `hello` con la lista de secciones mide entre 400 y 1100 bytes, así que **hoy no entra**.

### 2.5 Configuración y web

- `PedalConfig` guarda en `Preferences` (namespace `pedal`) tres tiempos y dos switches de conexión. No hay ningún campo de comportamiento.
- `WebConfigServer::handleConfig()` lee JSON con `ArduinoJson` (v7.4.3, ya incluida en `platformio.ini`) y guarda.
- `WebPages::dashboard()` ya recibe 11 parámetros posicionales. La tarjeta "Comportamiento" tiene los tres tiempos.
- `/diagnostico` (`DiagPage`, `DiagJson`, `PedalDiag`) tiene un registro circular de 100 entradas de hasta 96 caracteres, con categorías `SYS BTN EVT TCP SYNC BLE WIFI`.

### 2.6 Bluetooth

`BluetoothManager` expone `press / release / write` de una tecla. El mapeo actual: `'1'` = arriba, `'2'` = abajo, `'h'` = home, `'e'` = end. En la app, `BluetoothPedalAdapter` convierte `'1'`/`'2'` en `UP_PRESS`/`DOWN_PRESS` con un temporizador que emite el `RELEASE`. **Con un solo `write('2')` la app ya genera un salto en modo secciones**, no hace falta mandar `release`.

### 2.7 Hallazgo: el test existente falla por mi cambio anterior de `MINV`

Compilé y corrí `test/test_sync.cpp` contra el firmware actual:

```
FAIL line 29: r0.size()==2
FAIL line 39: sink.out.empty()
2 FALLAS
```

Causa: el mensaje `MINV` que agregué antes (límite de la pantalla más chica) hace que al unirse un cliente lleguen 3 mensajes (`CFG`, `POS`, `MINV`) en vez de 2, y que un `HELLO` repetido ya no sea silencioso. **No es un bug del firmware, es que el test describe el comportamiento anterior, y me olvidé de actualizarlo.** Lo corrijo en la Fase 3 (ver [9.1](#91-pruebas-en-pc-sin-hardware)).

---

## 3. Decisiones de diseño

Cada decisión con la alternativa que descarté y por qué.

### D1. El modo vive en el ESP32 y se elige en la web del pedal

- El modo (`lines` / `sections`) y el porcentaje de contexto (`overlap`) se guardan en `Preferences` y se cambian en la página web.
- El ESP32 los manda a todas las apps conectadas, y las apps solo los muestran.
- *Descartado:* que cada teléfono elija su modo. Con un pedal compartido, un teléfono en modo líneas y otro en modo secciones verían cosas distintas con el mismo pisotón. (La app puede seguir mostrando el modo, pero no decidirlo.)

### D2. En modo secciones: toque al soltar, mantener = inicio/final, sin doble toque

| Gesto | Resultado |
|---|---|
| Toque corto (se suelta antes de `sectionHoldMs`) | Un toque (`UP_TAP` / `DOWN_TAP`) **al soltar** |
| Mantener ≥ `sectionHoldMs` (1,5 s por defecto) | `HOME` (arriba) / `END` (abajo), **una sola vez**, mientras sigue apretado |
| Soltar después de haber disparado el "mantener" | No hace nada |
| Dos toques rápidos | **Dos** toques (no hay ventana de doble toque) |

Por qué **al soltar** y no al apretar:

- Si el toque se disparara al apretar, mantener para ir al final empezaría avanzando una sección. Al soltar, se sabe si fue toque o mantener.
- Si se aprietan los dos botones a la vez (reset de WiFi), el primero no dispara un toque por error.
- El costo es la duración del pisotón (típicamente 80 a 200 ms) más el antirrebote de 50 ms. Es menos que lo que tarda la animación de scroll de la app (~700 ms).

*Alternativa que dejo anotada:* un ajuste `tapOnPress` para quien prefiera el toque inmediato. No lo implemento salvo que lo pidas ([11](#11-riesgos-y-decisiones-que-necesito-de-vos)).

### D3. El ESP32 es dueño del índice de sección de cada canción

- Cada `Song` guarda su lista de secciones y su `sectionIndex` (`-1` = antes de la primera).
- Un toque cambia el índice **de todas las canciones abiertas**, igual que hoy el movimiento afecta a todas. Cada canción se recorta a su propio rango.
- *Descartado:* que cada app lleve su índice. Es la causa de la desincronización actual.

### D4. Protocolo nuevo en JSON, protocolo viejo intacto, detección por el primer carácter

- Una línea que empieza con `{` es JSON (v1). Cualquier otra cosa va por el parser de texto de hoy, **sin tocarlo**.
- El firmware recuerda qué protocolo habla cada cliente (`proto`), según con qué mensaje se presentó. Un cliente que manda `HELLO ...` (texto) recibe `CFG`/`POS`/`MINV` en texto como hoy. Uno que manda `{"t":"hello",...}` recibe `cfg` y `sec` en JSON.
- Se mantiene `POS` y `MINV` en texto también para los clientes v1: ya están probados y su formato es trivial. El JSON se usa para lo nuevo (`hello`, `leave`, `resync`, `cfg`, `sec`).
- *Descartado:* pasar todo a JSON de golpe. Rompe apps viejas y obliga a rehacer el test que ya funciona.

### D5. Los eventos crudos siguen saliendo por TCP y Bluetooth

`UP_PRESS`, `DOWN_PRESS`, `HOME`, `END` siguen emitiéndose por TCP (a todos) y BLE. Sirve para depurar y para que la app que tenés hoy funcione con el pedal en modo secciones (ver Fase 2). La app v1 tiene que ignorar los eventos de origen Wi-Fi cuando el modo sea secciones.

Un toque en modo secciones emite por TCP las dos líneas `DOWN_PRESS\nDOWN_RELEASE\n` seguidas. La app de hoy salta en el `PRESS` e ignora el `RELEASE`.

### D6. En modo secciones, el ESP32 no mueve la posición continua

`motionStart()` / `motionStop()` se ignoran si el modo no es líneas. Así no hay `POS ... moving=1` pisando nada.

### D7. Canciones sin secciones: el pedal "pagina"

Si una canción no tiene etiquetas (`sectionCount == 0`), en modo secciones cada toque avanza `pageLines = max(1, minVisible − round(minVisible × overlap))` líneas. Con 14 líneas visibles y 30 % de contexto son 10 líneas. Así el pedal no queda inerte.

### D8. La posición en líneas y el índice de sección se mantienen coherentes

Cada vez que cambia el índice de sección, el ESP32 actualiza también `song.pos` a la línea de esa sección (o `0` si el índice es `-1`). Así:

- `POS` (para clientes viejos y para cambiar de modo) siempre dice algo razonable.
- Al pasar de líneas a secciones, el índice se deriva de `pos` (la última sección con `line ≤ pos`).

### D9. Quién "es dueño" de la lista de secciones de una canción

La `songKey` sale del contenido de la canción, así que dos dispositivos con la misma `songKey` deberían mandar **la misma lista**. Reglas:

1. La primera que llega con `sections` se adopta y el cliente queda como "dueño".
2. Si el dueño manda otra lista (cambió la letra sin cambiar de clave, o transposición con cambio de estructura), se reemplaza y el índice se recorta al nuevo rango.
3. Si otro cliente manda una lista distinta, **no se adopta** y se anota en el registro (con el checksum de las dos).
4. Si el dueño se va, la canción queda sin dueño y la próxima lista que llegue se adopta.

El checksum es un FNV-1a de 16 bits sobre las líneas y las etiquetas. Sirve para comparar y para mostrar en el diagnóstico.

---

## 4. Fases de implementación

Las fases están ordenadas para que **cada una se pueda flashear y probar sola**, y para que las dos primeras funcionen con la app que ya tenés.

| Fase | Contenido | Archivos principales | Necesita cambios en la app | Cómo se prueba |
|---|---|---|---|---|
| **F1** | Configuración persistente (modo, contexto, tiempo de mantener) + selector en la web | `PedalConfig.*`, `WebPages.*`, `WebConfigServer.*` | No | Cambiar el modo en la web, reiniciar, ver que se conserva |
| **F2** | Toques inmediatos en modo secciones, protegidos contra reset de WiFi | `SectionGesture.h` (nuevo), `PedalButtons.*`, `PedalEventManager.*` | No (la app de hoy sirve, con su modo local en "secciones") | Un toque = una sección; dos toques = dos secciones |
| **F3** | Secciones en el modelo de sincronización + protocolo JSON v1 | `PedalSyncModel.*`, `test/test_sync.cpp` | Sí (parser JSON, `hello` con secciones, `sec`) | Tests en PC, sin hardware |
| **F4** | Integración con el servidor TCP: buffers, despacho JSON, difusión del modo | `PedalSocketServer.*`, `WebConfigServer.*` | Sí (junto con F3) | Dos dispositivos, pantallas distintas |
| **F5** | Diagnóstico: categoría `SEC`, protocolo por dispositivo, sección por canción | `PedalDiag.*`, `DiagJson.*`, `DiagPage.cpp` | No | `/diagnostico` |

Después de F2 ya se puede probar el pedal en modo secciones con la app actual. F3 y F4 se entregan juntas con la parte de la app, porque el protocolo nuevo no tiene sentido sin su lado cliente.

---

## 5. Detalle por archivo

Los fragmentos son bocetos de intención, no código final.

### 5.1 `config/PedalConfig.h` / `.cpp` (F1)

Agregar:

```cpp
enum class PedalMode : uint8_t { LINES = 0, SECTIONS = 1 };

struct PedalBehaviorConfig {
    PedalMode mode;               // LINES por defecto
    uint8_t overlapPercent;       // 0..60, por defecto 30
    unsigned long sectionHoldMs;  // mantener para HOME/END, por defecto 1500
};
```

Y en la clase:

```cpp
static constexpr uint8_t DEFAULT_OVERLAP_PERCENT = 30;
static constexpr uint8_t MIN_OVERLAP_PERCENT = 0;
static constexpr uint8_t MAX_OVERLAP_PERCENT = 60;

static constexpr unsigned long DEFAULT_SECTION_HOLD_MS = 1500;
static constexpr unsigned long MIN_SECTION_HOLD_MS = 600;
static constexpr unsigned long MAX_SECTION_HOLD_MS = 5000;

const PedalBehaviorConfig& behavior() const;
PedalBehaviorConfig& behavior();
```

- `begin()`: leer `mode` (`getUChar`), `overlap` (`getUChar`), `sectionHold` (`getUInt`). **Las claves de NVS tienen un máximo de 15 caracteres**; estas tres entran.
- `clamp()`: acota `overlapPercent` y `sectionHoldMs`; si `mode` no es un valor válido, vuelve a `LINES`.
- `save()` y `reset()`: incluir los tres campos.
- El `Serial` de arranque imprime también el modo y los valores.
- **Importante:** `sectionHoldMs` tiene que ser **mayor** que `holdThresholdMs` para que no se solapen conceptos. No es obligatorio porque son modos distintos, pero se muestra una nota en la web.

### 5.2 `web/WebPages.h` / `.cpp` y `web/WebConfigServer.cpp` (F1)

**Tarjeta "Modo del pedal"** nueva, antes de "Comportamiento":

```html
<label>Modo del pedal</label>
<select id="mode" onchange="toggleModeFields()">
  <option value="lines">Scroll por líneas</option>
  <option value="sections">Salto por secciones</option>
</select>

<div id="sectionFields">
  <label>Contexto de la sección anterior (%)</label>
  <input id="overlap" type="number" min="0" max="60">
  <label>Mantener para ir al inicio / final (ms)</label>
  <input id="sectionHold" type="number" min="600" max="5000">
  <p class="muted"><small>Un toque corto avanza o retrocede una sección.
  Mantener apretado lleva al inicio (botón de arriba) o al final (botón de abajo).</small></p>
</div>
```

- `toggleModeFields()` muestra u oculta `#sectionFields` según el modo. Sin esto, los campos confunden en modo líneas.
- Los campos de "Comportamiento" que solo aplican a modo líneas (ventana de doble toque, tiempo para comenzar scroll) quedan visibles pero con una nota: "Solo modo líneas".
- `WebPages::dashboard(...)` recibe tres parámetros más: `mode`, `overlapPercent`, `sectionHoldMs`. (Son 14 parámetros; si preferís, lo paso a una estructura `DashboardData`. Lo dejo como pregunta en [11](#11-riesgos-y-decisiones-que-necesito-de-vos).)
- `saveTiming()` en el JS manda `mode`, `overlapPercent` y `sectionHoldMs` en el `POST /api/config`.

**`WebConfigServer::handleConfig()`**:

1. Leer `mode` como string (`"lines"` / `"sections"`); cualquier otro valor se ignora y queda el actual.
2. Leer `overlapPercent` y `sectionHoldMs` con `readUInt`.
3. `config_->clamp(); config_->save();`.
4. Si cambió el modo: `buttons_->onModeChanged()` (corta cualquier scroll en curso, ver 5.3).
5. Si cambió el modo o el overlap: `socketServer_->applyBehavior()` (F4), que reenvía `cfg` a las apps **sin reiniciar**.

`handleConfigReset()` hace lo mismo tras `reset()`.

**`handleStatus()` / `jsonStatus()`**: agregar `"mode"` para que el panel lo muestre.

### 5.3 `input/SectionGesture.h` (nuevo) y `input/PedalButtons.h` / `.cpp` (F2)

#### a) `SectionGesture.h`: lógica pura, sin Arduino

La decisión "¿fue toque o mantener?" va en una clase chica que **no depende de Arduino**, así se prueba en PC como `PedalSyncModel`:

```cpp
class SectionGesture {
public:
    enum class Result : uint8_t { NONE, TAP, HOLD };

    /** Se llama en cada vuelta con el nivel ya filtrado por el antirrebote. */
    Result update(bool pressed, uint32_t now, uint32_t holdMs);

    /** Ignora este botón hasta que se suelte (por ejemplo, reset de WiFi). */
    void ignoreUntilRelease();
    void reset();

private:
    enum class State : uint8_t { IDLE, PRESSED, HELD, IGNORED };
    State state_ = State::IDLE;
    uint32_t pressedAt_ = 0;
};
```

Reglas:

- `IDLE` + apretado → `PRESSED`, anota `pressedAt_`.
- `PRESSED` + soltado → `TAP` (siempre que no haya pasado `holdMs`), vuelve a `IDLE`.
- `PRESSED` + (ahora − `pressedAt_`) ≥ `holdMs` → `HOLD` **una vez**, pasa a `HELD`.
- `HELD` + soltado → `NONE`, vuelve a `IDLE`.
- `IGNORED` + soltado → `NONE`, vuelve a `IDLE`. Mientras siga apretado no emite nada.
- Toda la aritmética de tiempo es `uint32_t` sin signo, así sobrevive al desbordamiento de `millis()` (~49 días), igual que lo que ya valida `test_sync.cpp`.

#### b) `PedalEvent` y `PedalButtons`

- `PedalButtons.h`: agregar `UP_TAP` y `DOWN_TAP` a `enum class PedalEvent`. `HOME` y `END` se reutilizan para el "mantener".
- Dos instancias de `SectionGesture` (`upGesture_`, `downGesture_`).
- En `update()`, después de `checkWifiReset()`:

```cpp
if (config_->behavior().mode == PedalMode::SECTIONS) {
    updateSectionsMode(upPressed, downPressed, now);
} else {
    // Código actual, sin cambios
    updateUp(upPressed, now);
    updateDown(downPressed, now);
}
```

- `updateSectionsMode()`:
  - `TAP` del botón de arriba → `emit(UP_TAP)`; del de abajo → `emit(DOWN_TAP)`.
  - `HOLD` de arriba → `emit(HOME)`; de abajo → `emit(END)`.
  - Cada resultado se anota en el registro de diagnóstico (`BTN`): `"UP: toque"`, `"DOWN: mantenido → END"`.

#### c) Protección del reset de WiFi

`checkWifiReset()` ya pausa la lógica mientras los dos botones están apretados. Para el modo secciones agrego: en el instante en que se detecta "ambos apretados", `upGesture_.ignoreUntilRelease()` y `downGesture_.ignoreUntilRelease()`. Así, al soltar, ninguno dispara un toque o un mantener por la pulsación vieja. (En modo líneas el comportamiento actual no cambia.)

#### d) Cambio de modo en caliente

`void PedalButtons::onModeChanged()`:

1. Si algún botón estaba en `SCROLLING` (modo líneas), emite `UP_RELEASE` / `DOWN_RELEASE` para que el movimiento compartido y el scroll de la app **no queden trabados**.
2. `cancelButtonStates()` y `reset()` de los dos `SectionGesture`.
3. Anota en el registro: `"modo de botones: secciones"`.

#### e) Diagnóstico de botones

`State` y `stateName()`: el snapshot de botones (`ButtonSnapshot.upState/downState`) muestra el estado del modo activo (`PRESSED`, `HELD`, `IGNORED` además de los actuales). `DiagJson` ya lo vuelca como texto, no requiere cambios de formato.

### 5.4 `output/PedalEventManager.cpp` (F2 y F4)

Hoy cada caso hace `sendPress/sendRelease/sendWrite` y luego `syncMotionStart/Stop` o `syncHome/End`. Cambios:

```cpp
case PedalEvent::UP_TAP:
    sendTap("UP_PRESS\nUP_RELEASE\n", '1');       // TCP (dos líneas) + BLE write
    socketServer_->syncSectionStep(-1);           // F4: no-op hasta entonces
    break;

case PedalEvent::DOWN_TAP:
    sendTap("DOWN_PRESS\nDOWN_RELEASE\n", '2');
    socketServer_->syncSectionStep(+1);
    break;
```

- `sendTap(tcpMessages, bleKey)`:
  - `logDelivery()` con el nombre `UP_TAP` / `DOWN_TAP` para que en `/diagnostico` se vea "toque" y no "press".
  - TCP: `broadcast(tcpMessages)` (las dos líneas juntas).
  - BLE: `bluetooth_->write(bleKey)`. **Un solo `write`**, sin `press`/`release` largos. La app ya lo trata bien.
- `HOME` y `END` no cambian en `PedalEventManager`: siguen llamando `syncHome()` / `syncEnd()`. El **modelo** decide qué hacer según el modo (D6): en modo secciones lleva el índice a `-1` / última sección.
- `cancelActivePresses()` no cambia.

Nota sobre BLE: `BluetoothInputBridge` de la app descarta la misma tecla repetida en menos de 150 ms. Dos pisotones más rápidos que eso (poco realista con el pie) contarían como uno.

### 5.5 `PedalSyncModel.h` / `.cpp` (F3)

Es el cambio más grande. Se mantiene la regla de **no depender de Arduino**: para JSON se usa `ArduinoJson` (v7.4.3), que compila igual en PC (lo comprobé con `g++ -std=c++11` y el `ArduinoJson` de `.pio/libdeps`).

#### Datos nuevos

```cpp
static const uint8_t  MAX_SECTIONS = 32;
static const uint8_t  LABEL_MAX    = 21;   // 20 bytes útiles + '\0'

enum class Mode : uint8_t { LINES = 0, SECTIONS = 1 };

struct SectionInfo {
    uint16_t line;
    char label[LABEL_MAX];
};

struct ClientInfo {            // ya existe; se agrega:
    uint8_t proto;             // 0 = texto (viejo), 1 = JSON v1
};

struct Song {                  // ya existe; se agrega:
    uint8_t  sectionCount;
    SectionInfo sections[MAX_SECTIONS];
    int8_t   sectionIndex;     // -1 = antes de la primera
    uint16_t sectionsChecksum;
    uint8_t  sectionsOwner;    // slot dueño de la lista, 0xFF = nadie
    uint32_t seq;              // contador de mensajes `sec` de esta canción
};

Mode mode_ = Mode::LINES;
float overlap_ = 0.30f;
```

#### Interfaz nueva

```cpp
void setMode(Mode mode, float overlap);   // lo llama el servidor al cambiar la config
Mode mode() const;

void sectionStep(int8_t dir);             // +1 siguiente, -1 anterior

// Consultas para diagnóstico y tests
bool sectionState(const char* key, int8_t& index, uint8_t& count,
                  uint32_t& seq, uint16_t& checksum) const;
uint8_t clientProto(uint8_t slot) const;
```

#### Comportamiento

**`onClientLine(slot, line)`**

- Si `line[0] == '{'` → `onClientJson(slot, line)`.
- Si no → el parser de texto actual. **Byte a byte igual que hoy**, incluido el `char buffer[128]`.

**`onClientJson(slot, line)`** (parseo con `ArduinoJson`, `deserializeJson` sobre `const char*`):

- Valida `v == 1`, `t` conocido. Cualquier error de parseo se ignora y se anota en el registro (`SYNC`: `"slot N: JSON inválido (código)"`). **Nunca reinicia ni bloquea.**
- `hello`: igual que el `HELLO` de texto (misma validación de `song`, `visible`, `total`, `pos`) más:
  - marca `client.proto = 1`;
  - procesa `sections` (ver más abajo);
  - al unirse: `sendConfigJson(slot)` y, según el modo, `sendSectionState(slot, song, "join")` o `sendPos(...)`;
  - `broadcastMinVisible(key)` como hoy.
- `leave`: igual que `LEAVE`.
- `resync`: responde `cfg` + el estado vigente (`sec` con `cause:"resync"` o `POS`). Sirve para recuperarse de un mensaje perdido.

**Procesar `sections`** (en `hello`, opcional):

1. Máximo `MAX_SECTIONS`. Si hay más, se toman las primeras y se anota el recorte.
2. `line` se acota a `[0, total)` y las líneas tienen que venir **estrictamente crecientes**; si no, se descarta la lista completa (y se anota).
3. Las etiquetas se copian con tope de `LABEL_MAX − 1` bytes **sin partir un carácter UTF-8** (se retrocede hasta un byte de inicio). Si se cortara a la mitad, el JSON de salida quedaría inválido.
4. Se calcula el checksum y se aplican las reglas de dueño de **D9**.
5. Si la lista cambió, `sectionIndex` se recorta al nuevo rango y se manda `sec` con `cause:"reset"` a los clientes de esa canción.

**`sectionStep(dir)`**, para cada canción en uso:

- Con secciones: `sectionIndex = clamp(sectionIndex + dir, -1, count − 1)`; actualiza `song.pos` a la línea de la sección (D8); `seq++`; difunde `sec` con `cause:"next"` / `"prev"` y `changed` = si el índice cambió.
- Sin secciones: pagina (D7) y difunde `sec` con `count:0`, `cause:"page"` y el `pos` nuevo.
- Para **clientes viejos** (texto), en cualquier caso, difunde `POS ... 0` con `song.pos`.
- Se ejecuta **solo** si `mode_ == SECTIONS`; en modo líneas no hace nada.

**`goHome()` / `goEnd()`**: en modo líneas, igual que hoy. En modo secciones: índice `-1` / última, `pos` coherente, difunde `sec` con `cause:"home"` / `"end"`.

**`motionStart()` / `motionStop()`**: `if (mode_ != Mode::LINES) return;` al principio (D6).

**`setMode(mode, overlap)`**:

1. Si el movimiento estaba activo, se detiene.
2. Pasando a secciones: para cada canción, el índice se deriva de `pos`.
   Pasando a líneas: `pos` ya está coherente por D8.
3. `sendConfigJson` a los clientes v1; `sec` (`cause:"mode"`) o `POS` según el modo.
4. Clientes viejos: `POS ... 0` con la posición vigente.

**`broadcastSection` / `sendSectionState(slot, song, cause)`**: arma el JSON (ver [6](#6-especificación-del-protocolo-v1)). Escapa `"`, `\` y caracteres de control. Si el mensaje no entra en el buffer de 640 bytes, reintenta **sin etiquetas** (solo índices y líneas) y lo anota. Nunca se manda un JSON cortado.

**`sendConfig(slot)`**: si `client.proto == 1`, manda el `cfg` JSON; si no, el `CFG %.2f %u` de texto exacto de hoy.

**`broadcastMinVisible`**: sin cambios.

**`onClientDisconnected`**: además de lo actual, si el cliente era dueño de la lista de una canción, `sectionsOwner = 0xFF`.

### 5.6 `network/PedalSocketServer.h` / `.cpp` (F4)

- `RX_MAX`: **128 → 1280**. El peor caso de un `hello` (32 secciones con etiquetas de 20 bytes) mide ~1050 bytes. Son 7 × 1280 = 8,75 KB de RAM estática en total.
- `RX_BYTES_PER_UPDATE`: **256 → 512**, para absorber un `hello` en pocas vueltas del `loop()`.
- `readClients()`: sin cambios de lógica; solo los tamaños. El aviso "línea demasiado larga" se conserva.
- Nuevos métodos públicos:

```cpp
void syncSectionStep(int8_t dir);   // lo llama PedalEventManager
void applyBehavior();               // lee config.behavior() y llama sync_.setMode()
```

- `begin()`: después de `sync_.begin(...)`, llama a `applyBehavior()` para que arranque con el modo guardado.
- `syncMotionStart/Stop/Home/End`: sin cambios (la decisión por modo está en el modelo).
- `deviceDiag()`: agrega `proto` y cantidad de secciones de la canción del dispositivo.
- `songDiag()`: agrega `sectionIndex`, `sectionCount`, `seq`, `checksum`.

### 5.7 `diag/` (F5)

- `PedalDiag.h`: nueva categoría `SEC = 7` y su nombre en `catName()`. `PedalDiag::MSG_MAX` es **96 caracteres**, así que lo que se registre es un **resumen**, no el JSON entero: `"sec song=a1b2c3 #42 next 2/5 'Coro' → 2 clientes"`.
- `DiagJson.h/.cpp`: agregar
  - global: `"mode"`, `"overlapPercent"`, `"sectionHoldMs"`;
  - por dispositivo: `"proto"` (0/1) y `"sections"`;
  - por canción: `"sectionIndex"`, `"sectionCount"`, `"seq"`, `"checksum"`, `"label"` de la sección actual.
- `DiagPage.cpp`: agregar `SEC` a la lista `CATS`, un color `.c-SEC{background:#fb7185}`, y en cada tarjeta de canción una línea tipo "sección 2/5 · Coro · #42". En cada dispositivo, una etiqueta "v1" o "texto".
- Registro de eventos nuevos:
  - `BTN`: toque / mantenido / ignorado.
  - `EVT`: `UP_TAP`, `DOWN_TAP` con el resultado de la entrega.
  - `SEC`: cada `sec` difundido (con `seq`, `cause` y a cuántos clientes llegó), cada lista de secciones adoptada o rechazada, y cada `resync`.

---

## 6. Especificación del protocolo v1

Una línea por mensaje, terminada en `\n`, codificación UTF-8. Una línea que empieza con `{` es JSON; el resto, texto como hoy.

### 6.1 Cliente → ESP32

#### `hello`: "abrí esta canción"

```json
{"t":"hello","v":1,"song":"a1b2c3","visible":14,"total":86,"pos":0.0,
 "sections":[[2,"Intro"],[5,"Verso 1"],[18,"Coro"],[27,"Verso 2"],[42,"Puente"]]}
```

| Campo | Regla |
|---|---|
| `v` | Tiene que ser `1` |
| `song` | 1 a 39 bytes, igual que la clave actual |
| `visible`, `total` | Enteros; `total ≥ 1` |
| `pos` | Solo se usa si el cliente es el primero en abrir esa canción |
| `sections` | **Opcional.** Pares `[línea, "etiqueta"]`, **sin el título**, líneas estrictamente crecientes. Máximo 32. Etiquetas de hasta 20 bytes (la app trunca) |

Se reenvía cuando cambia la pantalla o la letra. Un `hello` repetido de la misma canción solo actualiza datos (no responde `cfg`), como hoy.

#### `leave`

```json
{"t":"leave","v":1,"song":"a1b2c3"}
```

#### `resync`

```json
{"t":"resync","v":1,"song":"a1b2c3"}
```

El ESP32 responde `cfg` y el estado vigente. Se usa al volver a primer plano, tras una reconexión o si falta un `seq`.

### 6.2 ESP32 → cliente (solo a clientes v1)

#### `cfg`

```json
{"t":"cfg","v":1,"mode":"sections","linesPerSec":2.0,"rampMs":150,"overlap":0.30}
```

Se manda al unirse a una canción, al cambiar el modo o el contexto en la web, y en respuesta a `resync`.

#### `sec`: estado de secciones

```json
{"t":"sec","v":1,"song":"a1b2c3","seq":42,"cause":"next","changed":true,
 "index":2,"count":5,"pos":18.0,
 "prev":{"i":1,"line":5,"label":"Verso 1"},
 "cur":{"i":2,"line":18,"label":"Coro"},
 "next":{"i":3,"line":27,"label":"Verso 2"}}
```

| Campo | Significado |
|---|---|
| `seq` | Contador por canción, +1 en cada `sec`. Si un cliente ve un salto (41 → 43), pide `resync` |
| `cause` | `next`, `prev`, `home`, `end`, `join`, `resync`, `mode`, `reset`, `page` |
| `changed` | `false` si el toque no movió el índice (ya estaba en el extremo). La app **igual** puede reaplicar `cur` (es idempotente) |
| `index` | Sección activa. `-1` = antes de la primera (`cur` es `null`) |
| `count` | Cantidad de secciones. `0` = canción sin secciones |
| `pos` | Posición en líneas coherente con la sección (D8). Es lo que usa la app cuando `count == 0` o `cause == "page"` |
| `prev` / `cur` / `next` | `null` si no existen |

Cómo debe interpretarlo la app según `cause`:

- `home`: ir al principio de la canción.
- `end`: ir al final de la canción.
- `page` (o `count == 0`): ir a `pos` (paginado).
- Cualquier otro: alinear `cur.line` al punto de contexto (`overlap`).
- `join`, `resync`, `mode`, `reset`: igual que el anterior, pero **sin animación** (es un reposicionamiento, no un pedal).

### 6.3 Mensajes de texto que se conservan

`POS <song> <pos> <moving>` y `MINV <song> <minVisible>` siguen en texto para todos. Y el `CFG <linesPerSec> <rampMs>` de texto sigue para los clientes que se presentan con `HELLO` de texto.

### 6.4 Errores y casos borde

| Caso | Qué hace el firmware |
|---|---|
| JSON mal formado o truncado | Lo ignora y lo registra; no afecta a otros clientes |
| `v` distinto de 1 | Lo ignora y lo registra |
| Línea más larga que `RX_MAX` | Se descarta hasta el próximo `\n` (ya existe) |
| Lista de secciones inválida (líneas no crecientes) | Se descarta la lista; el `hello` se procesa igual, sin secciones |
| Más de 32 secciones | Se toman las primeras 32 |
| Cliente v1 que cambia de canción sin `leave` | Funciona igual que hoy: el `hello` nuevo reemplaza la canción |
| Cliente que se desconecta | Se libera su canción si era la última; si era dueño de la lista, queda sin dueño |

---

## 7. Memoria, tiempos y límites

| Concepto | Hoy | Después | Diferencia |
|---|---|---|---|
| Buffers de recepción (7 clientes) | 7 × 128 B = 0,9 KB | 7 × 1280 B = 8,75 KB | +7,9 KB |
| `Song` (7 canciones) | ~7 × 50 B | ~7 × 900 B | +6 KB |
| `ClientInfo` | ~7 × 50 B | +1 B por cliente | despreciable |
| Mensaje `sec` (pila, durante el envío) | — | 640 B | pasajero |
| **Total estático** | | | **≈ +14 KB** |

- El ESP32 tiene ~320 KB de RAM de datos, pero WiFi + BLE consumen buena parte. **Antes de empezar anoto `heapFree` y `heapMin` de `/diagnostico`** y los comparo después de cada fase. Si `heapMin` queda por debajo de ~50 KB, bajo `RX_MAX` a 768 y `MAX_SECTIONS` a 24.
- La pila del `loop()` (8 KB por defecto) alcanza: el JSON de entrada usa el heap de `ArduinoJson`, y el de salida un buffer de 640 B.
- **Latencia de un toque** (desde que se suelta el pulsador hasta que llega el `sec`): antirrebote ya cumplido + ~1 vuelta del `loop()` + TCP en LAN (típicamente < 20 ms). La demora percibida es dominada por la duración del pisotón.
- **Tráfico:** un `sec` mide ~300 bytes y se manda solo cuando hay un toque. No hay tráfico periódico en modo secciones (ya no hay `POS moving=1` cada 250 ms).

---

## 8. Diagnóstico y depuración

Lo que pediste: que el JSON sirva para depurar. Lo que va a quedar disponible:

1. **Cada `sec` lleva `seq` y `cause`.** En `/diagnostico` (categoría `SEC`) se ve cada difusión con cuántos clientes la recibieron. En la app se loguea cada `sec` recibido; si los `seq` no son consecutivos, hubo pérdida.
2. **Por dispositivo:** si habla texto o v1, cuántas secciones tiene su canción y su pantalla (`visible`).
3. **Por canción:** `sección i/N · etiqueta · seq · checksum`. Si dos dispositivos tienen la misma canción pero el `checksum` rechazado aparece en el registro, se ve de inmediato que **las listas de secciones no coinciden**.
4. **Botones:** el estado del gesto (`PRESSED`, `HELD`, `IGNORED`) y cada resultado (`toque`, `mantenido`) en el registro `BTN`.
5. **Registro de rechazos:** JSON inválido, lista descartada, recorte a 32 secciones, etiquetas truncadas.
6. **`resync` manual:** si en el futuro se agrega un botón en la web, solo hay que difundir el estado actual.
7. **Serial:** cada `sec` también sale por el puerto serie (`[SYNC]`), como ya pasa con `HELLO`.

---

## 9. Plan de pruebas

### 9.1 Pruebas en PC (sin hardware)

Se compilan con `g++ -std=c++11 -Isrc -I.pio/libdeps/nodemcu-32s/ArduinoJson/src`, igual que `test_sync.cpp`.

**Corrección de lo existente (F3):** actualizar `test_sync.cpp` para el `MINV`:

- Test 1: al unirse llegan `CFG`, `POS` y `MINV` (3 mensajes), en ese orden.
- Test 3: un `HELLO` repetido solo genera `MINV`, no `CFG` ni `POS`.

**Nuevos, en `test_sync.cpp` (F3):**

1. `hello` JSON con 5 secciones: llega `cfg` JSON y, en modo secciones, `sec` con `cause:"join"` y `index:-1`.
2. Un cliente de texto y uno JSON en la misma canción: cada uno recibe **su** formato.
3. `sectionStep(+1)` ×3 → índices 0, 1, 2; `prev`/`cur`/`next` correctos; `pos` coherente.
4. `sectionStep(+1)` pasado el final: el índice no se pasa y `changed:false`.
5. `sectionStep(-1)` desde el índice 0 → `-1`; `cur` es `null`.
6. `goHome()` / `goEnd()` en modo secciones → `cause:"home"` / `"end"`.
7. Dos clientes con la misma canción reciben todos los `sec`; uno con otra canción no recibe nada de esta.
8. Un tercero se une a mitad de canción: recibe el `sec` vigente (`join`), sin cambiar el índice.
9. Dos canciones abiertas con distinta cantidad de secciones: un toque mueve las dos, cada una recortada a su rango.
10. Lista de secciones distinta de otro cliente: se rechaza y queda registrada; el índice no cambia.
11. El dueño manda otra lista: se reemplaza, el índice se recorta, `cause:"reset"`.
12. El dueño se desconecta: la próxima lista se adopta.
13. `hello` con líneas no crecientes: lista descartada, el `hello` igual se procesa.
14. `hello` con 40 secciones: se toman 32.
15. Etiqueta con carácter UTF-8 multibyte justo en el límite: no se parte; el `sec` resultante es JSON válido (se valida reparseándolo con `ArduinoJson`).
16. Etiqueta con comillas, barra invertida y salto de línea: el `sec` sigue siendo JSON válido.
17. JSON truncado, `v:2`, `t` desconocido, campos con tipo incorrecto: se ignoran sin tocar el estado.
18. Canción sin secciones en modo secciones: cada toque pagina `visible − round(visible × overlap)` líneas, con `count:0`.
19. `setMode` líneas → secciones → líneas: el índice se deriva de `pos` y `pos` queda coherente al volver.
20. En modo secciones, `motionStart()` no activa el movimiento ni emite `POS moving=1`.
21. `resync` devuelve `cfg` + estado vigente.
22. **Regresión de modo líneas:** todos los tests actuales de movimiento, rampa, `HOME`/`END`, múltiples canciones, wrap de `millis()` y loop irregular siguen pasando **sin cambios** (con los dos ajustes de `MINV`).

**Nuevo `test/test_gesture.cpp` (F2)**, sobre `SectionGesture`:

1. Toque de 100 ms → `TAP` al soltar.
2. Toque de 60 ms (justo sobre el antirrebote) → `TAP`.
3. Mantener 1,6 s con `holdMs = 1500` → `HOLD` **a los 1,5 s, una sola vez**, y nada al soltar.
4. Mantener 1,2 s y soltar → `TAP` (no llegó al mantener).
5. Dos toques separados 300 ms → dos `TAP`.
6. `ignoreUntilRelease()` mientras está apretado → no emite nada hasta soltar; después vuelve a funcionar.
7. Cruce del desbordamiento de `millis()` durante un toque y durante un mantener.
8. `reset()` en `PRESSED`: no emite nada al soltar.

### 9.2 Pruebas en hardware (checklist)

**F1**
- [ ] El selector aparece en la web y muestra el modo guardado.
- [ ] Cambiar el modo y reiniciar: se conserva.
- [ ] "Restaurar valores" vuelve a modo líneas, 30 %, 1500 ms.
- [ ] Un valor fuera de rango (por ejemplo, 90 %) queda acotado.

**F2**
- [ ] Modo líneas: el pedal se comporta **exactamente** como antes (mantener = scroll, doble toque = `HOME`/`END`).
- [ ] Modo secciones: un toque corto genera un `UP_TAP` / `DOWN_TAP` en `/diagnostico`.
- [ ] Dos toques rápidos generan **dos** toques y ningún `HOME`/`END`.
- [ ] Mantener 1,5 s en ABAJO genera `END` una sola vez; al soltar no pasa nada más.
- [ ] Apretar los dos botones por 3 s resetea el WiFi como siempre, **sin** generar toques al soltar.
- [ ] Cambiar de modo desde la web mientras se mantiene un botón: no queda scroll trabado.
- [ ] Con la app de hoy en modo secciones: un toque salta una sección, sin "ir y volver".
- [ ] Bluetooth conectado: un toque manda una sola tecla.

**F3 + F4**
- [ ] Dos dispositivos de tamaños distintos con la misma canción: un toque lleva a los dos a la misma sección.
- [ ] Un tercer dispositivo entra a mitad de canción: aparece en la sección vigente.
- [ ] Apagar el WiFi de un teléfono y reconectar: se resincroniza con `resync`.
- [ ] Cambiar el modo en la web con las apps conectadas: pasan de modo sin reconectar.
- [ ] Transponer en un dispositivo: no cambia la sección en ninguno.
- [ ] Canción sin etiquetas: el pedal pagina.
- [ ] `heapFree` / `heapMin` dentro de lo esperado tras 10 minutos con 3 dispositivos.

**F5**
- [ ] `/diagnostico` muestra `proto`, sección actual, `seq` y los eventos `SEC`.

---

## 10. Qué tiene que cambiar la app en cada fase

| Fase | Cambio en la app |
|---|---|
| F1 | Ninguno |
| F2 | Ninguno. Para probar, la app tiene que estar en modo "Secciones" (su ajuste local) mientras el pedal está en modo secciones |
| F3 + F4 | **Parser JSON** en `WifiPedalAdapter` (`cfg`, `sec`), `hello` en JSON con la lista de secciones (la app ya las calcula en `useSongSections`), `leave` y `resync` en JSON, `onSection` en `PedalService` / `usePedal`. En `SongViewer`: aplicar `sec` con `scrollToSectionLine` (según `cause`), ignorar los eventos crudos Wi-Fi en modo secciones, tomar el modo y el overlap de `cfg` en vez de un ajuste local |
| F5 | Ninguno |

Hasta F2 la app que tenés (con los pasos 1 a 3 aplicados) alcanza. Entre F2 y F4, un pedal en modo secciones con una app que todavía maneja el modo localmente **funciona**, pero cada teléfono decide su propia sección. Esa es la limitación que F3 + F4 resuelven.

---

## 11. Riesgos y decisiones que necesito de vos

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Poca RAM libre con WiFi + BLE | Medir `heapMin` antes y después; parámetros de recorte ya definidos ([7](#7-memoria-tiempos-y-límites)) |
| `ArduinoJson` usa heap dinámico y puede fragmentar | Documentos locales y chicos que se destruyen en cada mensaje; sin documentos globales |
| Una app con lista de secciones distinta | Primera lista gana + checksum en el registro (D9) |
| Mensaje perdido | `seq` + `resync` |
| Romper el modo líneas | Es el modo por defecto, no se toca su código, y los tests existentes tienen que seguir pasando |
| Reflasheo | Cada fase es una versión que se puede probar sola, y la anterior queda como respaldo |

### Decisiones que necesito de vos

1. **¿Toque al soltar (recomendado) o al apretar?** Al soltar evita avanzar por error al mantener y protege el reset de WiFi, a cambio de unos 100 ms. Si querés inmediato, lo hago configurable.
2. **¿Mantener = `HOME`/`END` a los 1,5 s está bien?** Es configurable en la web (0,6 a 5 s).
3. **¿Límites de 32 secciones y 20 bytes por etiqueta?** Cubren cualquier canción razonable; las etiquetas largas se truncan.
4. **¿Dejo `WebPages::dashboard()` con parámetros posicionales (14) o lo paso a una estructura?** La estructura es más limpia pero toca más líneas.
5. **¿Que un toque en el extremo (última sección) reenvíe el `sec` con `changed:false`?** Lo propongo porque deja un rastro en el diagnóstico y la app puede reaplicar la posición. Si preferís silencio, lo cambio.
6. **¿Querés velocidad y rampa configurables desde la web?** Hoy son constantes (`DEFAULT_LINES_PER_SEC = 2.0`, `DEFAULT_RAMP_MS = 150`) y el `cfg` ya las transporta. No está en este alcance, pero es una línea más en la web.
7. **Secciones más largas que la pantalla.** Este plan no lo resuelve: con un toque por sección, el final de una sección muy larga no se ve. Una opción futura es "sub-pasos" (el `hello` incluye el largo de cada sección y el ESP32 avanza por páginas dentro de la sección). No la incluyo; conviene probar primero con canciones reales.

---

## 12. Entregables y orden de entrega

Te los paso **de a uno**, en este orden. Cada grupo es una versión que se puede flashear y probar.

**Grupo F1** (config + web)
1. `config/PedalConfig.h`
2. `config/PedalConfig.cpp`
3. `web/WebPages.h`
4. `web/WebPages.cpp`
5. `web/WebConfigServer.cpp`

**Grupo F2** (toques)
6. `input/SectionGesture.h` (nuevo)
7. `input/PedalButtons.h`
8. `input/PedalButtons.cpp`
9. `output/PedalEventManager.h`
10. `output/PedalEventManager.cpp`
11. `test/test_gesture.cpp` (nuevo)

**Grupo F3 + F4** (secciones + protocolo JSON), junto con los archivos de la app del [punto 10](#10-qué-tiene-que-cambiar-la-app-en-cada-fase)
12. `PedalSyncModel.h`
13. `PedalSyncModel.cpp`
14. `network/PedalSocketServer.h`
15. `network/PedalSocketServer.cpp`
16. `test/test_sync.cpp` (corregido y ampliado)

**Grupo F5** (diagnóstico)
17. `diag/PedalDiag.h` y `.cpp`
18. `diag/DiagJson.h` y `.cpp`
19. `diag/DiagPage.cpp`

Antes de entregar cada grupo corro los tests en PC y chequeo que compile con las mismas banderas del proyecto. Lo que no puedo probar desde acá (el hardware, el WiFi real, el BLE y la memoria) queda en el checklist de [9.2](#92-pruebas-en-hardware-checklist) para que lo verifiques con el pedal.
