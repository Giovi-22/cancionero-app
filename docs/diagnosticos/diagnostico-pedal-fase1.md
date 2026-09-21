# Diagnóstico Técnico: Fase 1 — Unificación de Pedal Bluetooth + WiFi

> **Fecha:** 21 de Septiembre de 2026  
> **Proyecto:** App Cancionero Mobile (Expo Router / React Native / TypeScript)  
> **Objetivo:** Unificar los transportes Bluetooth y WiFi bajo una misma abstracción de eventos de pedal, preservando exactamente el comportamiento y fluidez de Bluetooth actual e incorporando la funcionalidad de `HOME` y `END`.

---

## 1. Contexto y Reglas de Diseño

1. **Decisión de Conexión del Pedal**:
   * La aplicación puede descubrir pasivamente un pedal disponible en la red local (UDP 4444).
   * **Nunca debe conectarse automáticamente**. La conexión al pedal requiere una acción explícita del usuario.
   * Cada músico decide de forma independiente si conecta o no su dispositivo al pedal.
2. **Alcance de Fase 1**:
   * Exclusivamente la unificación local: `Bluetooth / WiFi -> IPedalAdapter -> PedalService -> PedalEvent -> PedalHandler -> useSongScroll / SongViewer`.
   * **No se modifica** en esta fase la sincronización Director/Follower ni Firestore.
3. **Preservación de Bluetooth**:
   * No se reescribe la captura de Bluetooth. Se mantiene la estrategia existente (`TextInput` invisible, foco periódico y mapeos de SQLite) encapsulada dentro de su adaptador.

---

## 2. Semántica del Modelo de Eventos (`PedalEventType`)

Se mantiene y formaliza el conjunto de 6 eventos:

```ts
export type PedalEventType =
    | 'UP_PRESS'
    | 'UP_RELEASE'
    | 'DOWN_PRESS'
    | 'DOWN_RELEASE'
    | 'HOME'
    | 'END';

export interface PedalEvent {
    type: PedalEventType;
    timestamp: number;
    source: 'bluetooth' | 'wifi';
}
```

### Tabla Semántica:

| Evento | Ámbito | Comportamiento en la Aplicación |
| :--- | :--- | :--- |
| **`UP_PRESS`** | Scroll continuo | Inicia aceleración suave hacia arriba mediante `requestAnimationFrame`. |
| **`UP_RELEASE`** | Scroll continuo | Detiene la aceleración y frena suavemente el scroll hacia arriba. |
| **`DOWN_PRESS`** | Scroll continuo | Inicia aceleración suave hacia abajo mediante `requestAnimationFrame`. |
| **`DOWN_RELEASE`** | Scroll continuo | Detiene la aceleración y frena suavemente el scroll hacia abajo. |
| **`HOME`** | **Intra-canción** | Lleva el scroll inmediatamente al **inicio** de la canción actual (`scrollY = 0`). |
| **`END`** | **Intra-canción** | Lleva el scroll inmediatamente al **final** de la canción actual (`scrollY = maxScrollY`). |

> [!IMPORTANT]
> **Distinción Crítica**: `HOME` y `END` operan sobre el desplazamiento vertical de la canción abierta. **No cambian de canción**.  
> El cambio de canción (`prev_page` / `next_page`) corresponde a la navegación entre temas de un setlist y es una funcionalidad separada.

---

## 3. Arquitectura: Actual vs Propuesta

### A. Arquitectura Actual

```text
BLUETOOTH (Acoplado a SongViewer)
[ESP32 BLE Keyboard]
       │ Teclas '1', '2' repetidas (~50ms)
       ▼
Android OS (HID Keyboard)
       │
       ▼
[PedalHandler.tsx]
 ├── <TextInput> invisible (opacidad 0.01)
 ├── Keep-alive de foco cada 2000ms
 ├── Mappings SQLite ('1' -> scroll_up, '2' -> scroll_down)
 └── Watchdog de 700ms (emula botón soltado)
       │ onScrollUp / onScrollDown / onScrollStop
       ▼
[SongViewer.tsx] ──> [useSongScroll.ts] (rAF / física)


WIFI / TCP (Aislado en Pantalla Debug)
[ESP32 WiFi]
 ├── UDP 4444 (Discovery)
 └── TCP 8080 ("UP_PRESS\n", "HOME\n", etc.)
       │
       ▼
[PedalService.ts] (Monolito con @isvend/expo-udp y react-native-tcp-socket)
       │
       ▼
[usePedal.ts]
       │
       ▼
[udp-test.tsx] (Debug UI - Se desconecta al desmontar pantalla)
```

---

### B. Arquitectura Propuesta para Fase 1

```text
                    ┌─────────────────────────┐
                    │       ESP32 Pedal       │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       [Bluetooth BLE HID]               [WiFi UDP / TCP]
                 │                               │
                 ▼                               ▼
      [BluetoothPedalAdapter]           [WifiPedalAdapter]
      - TextInput invisible             - UDP 4444 (Discovery pasivo)
      - Foco periódico / Watchdog       - TCP 8080 (Eventos \n)
      - Mapeos SQLite ('1' -> UP)       - Buffer de líneas TCP
                 │                               │
                 └───────────────┬───────────────┘
                                 │
                                 ▼ (Implementan IPedalAdapter)
                       ┌───────────────────┐
                       │   PedalService    │
                       │ (Fachada/Manager) │
                       └─────────┬─────────┘
                                 │
                                 ▼ Emite PedalEvent unificado
                       ┌───────────────────┐
                       │   PedalHandler    │ (Consumidor limpio)
                       └─────────┬─────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │ (Scroll)      │ (HOME)        │ (END)
                 ▼               ▼               ▼
            onScrollUp      onGoToStart     onGoToEnd
           onScrollDown          │               │
           onScrollStop          │               │
                 │               │               │
                 └───────────────┼───────────────┘
                                 ▼
                         [useSongScroll.ts]
                          ├── handlePedalScrollUp()
                          ├── handlePedalScrollDown()
                          ├── stopPedalScroll()
                          ├── goToSongStart() (y: 0)
                          └── goToSongEnd() (y: maxScroll)
                                 │
                                 ▼
                          [SongViewer.tsx]
```

---

## 4. Análisis de `HOME` y `END` en `useSongScroll.ts`

### Variables y Referencias Existentes en `useSongScroll.ts`:
* **`viewportHeightRef.current`**: Altura visible de la pantalla, capturada en `handleScrollAreaLayout`.
* **`contentHeightRef.current`**: Altura completa del texto/acordes, capturada en `handleContentSizeChange`.
* **`scrollPosRef.current`**: Posición Y actual en píxeles.
* **`scrollRef`**: Referencia al componente nativo `ScrollView`.
* **`getMaxScroll()`**: Función ya existente que calcula el límite inferior exacto:
  ```ts
  const getMaxScroll = useCallback(() => {
      return Math.max(
          0,
          contentHeightRef.current - viewportHeightRef.current
      );
  }, []);
  ```

### Implementación Técnica de `goToSongStart()` y `goToSongEnd()`:
Ambas funciones deben residir dentro de `useSongScroll.ts` para no duplicar llamadas a `ScrollView.scrollTo()` ni desincronizar la física interna:

```ts
/**
 * Desplaza inmediatamente el scroll al inicio de la canción (Y = 0).
 */
const goToSongStart = useCallback((animated = true) => {
    // 1. Frena cualquier inercia o aceleración continua del pedal
    stopPedalScroll();

    // 2. Fija la posición matemática en el inicio
    scrollPosRef.current = 0;

    // 3. Ejecuta el scroll en el componente nativo
    scrollRef.current?.scrollTo({
        y: 0,
        animated,
    });

    // 4. Notifica la nueva posición proporcional al centro visual
    notifyProgress(getScrollProgress(), true);
}, [stopPedalScroll, scrollRef, notifyProgress, getScrollProgress]);

/**
 * Desplaza inmediatamente el scroll al final de la canción (Y = maxScroll).
 */
const goToSongEnd = useCallback((animated = true) => {
    // 1. Frena cualquier inercia o aceleración continua del pedal
    stopPedalScroll();

    // 2. Calcula el límite real respetando dimensiones de viewport y contenido
    const maxScroll = getMaxScroll();

    // 3. Fija la posición matemática en el final
    scrollPosRef.current = maxScroll;

    // 4. Ejecuta el scroll en el componente nativo
    scrollRef.current?.scrollTo({
        y: maxScroll,
        animated,
    });

    // 5. Notifica la nueva posición proporcional al centro visual
    notifyProgress(getScrollProgress(), true);
}, [stopPedalScroll, getMaxScroll, scrollRef, notifyProgress, getScrollProgress]);
```

---

## 5. Tabla Completa de Mappings y Eventos (Fase 1)

| Dispositivo / Acción Hardware | Señal Física Emitida | Adaptador Responsable | `PedalEvent` Unificado | Handler en `PedalHandler` | Acción en `useSongScroll` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Botón UP (Presionar)** | TCP: `UP_PRESS\n` | `WifiPedalAdapter` | `{ type: 'UP_PRESS' }` | `onScrollUp()` | `handlePedalScrollUp()` |
| **Botón UP (Soltar)** | TCP: `UP_RELEASE\n` | `WifiPedalAdapter` | `{ type: 'UP_RELEASE' }` | `onScrollStop()` | `stopPedalScroll()` |
| **Botón DOWN (Presionar)** | TCP: `DOWN_PRESS\n` | `WifiPedalAdapter` | `{ type: 'DOWN_PRESS' }` | `onScrollDown()` | `handlePedalScrollDown()` |
| **Botón DOWN (Soltar)** | TCP: `DOWN_RELEASE\n` | `WifiPedalAdapter` | `{ type: 'DOWN_RELEASE' }` | `onScrollStop()` | `stopPedalScroll()` |
| **Botón UP (Mantener >1.5s)** | TCP: `HOME\n` | `WifiPedalAdapter` | `{ type: 'HOME' }` | `onGoToStart()` | `goToSongStart()` (`y: 0`) |
| **Botón DOWN (Mantener >1.5s)** | TCP: `END\n` | `WifiPedalAdapter` | `{ type: 'END' }` | `onGoToEnd()` | `goToSongEnd()` (`y: maxScroll`) |
| **Botón UP (Presionar)** | BLE: Tecla `'1'` | `BluetoothPedalAdapter` | `{ type: 'UP_PRESS' }` | `onScrollUp()` | `handlePedalScrollUp()` |
| **Botón UP (Soltar)** | BLE: Silencio >700ms | `BluetoothPedalAdapter` | `{ type: 'UP_RELEASE' }` | `onScrollStop()` | `stopPedalScroll()` |
| **Botón DOWN (Presionar)** | BLE: Tecla `'2'` | `BluetoothPedalAdapter` | `{ type: 'DOWN_PRESS' }` | `onScrollDown()` | `handlePedalScrollDown()` |
| **Botón DOWN (Soltar)** | BLE: Silencio >700ms | `BluetoothPedalAdapter` | `{ type: 'DOWN_RELEASE' }` | `onScrollStop()` | `stopPedalScroll()` |
| **Botón UP (Mantener >1.5s)** | BLE: Tecla `'h'` / `'Home'` | `BluetoothPedalAdapter` | `{ type: 'HOME' }` | `onGoToStart()` | `goToSongStart()` (`y: 0`) |
| **Botón DOWN (Mantener >1.5s)** | BLE: Tecla `'e'` / `'End'` | `BluetoothPedalAdapter` | `{ type: 'END' }` | `onGoToEnd()` | `goToSongEnd()` (`y: maxScroll`) |

---

## 6. Contrato de Adaptadores (`IPedalAdapter`)

```ts
export type PedalTransportType = 'bluetooth' | 'wifi';

export interface IPedalAdapter {
    readonly transport: PedalTransportType;

    isConnected(): boolean;
    isConnecting(): boolean;

    connect(target?: any): Promise<void>;
    disconnect(): void;

    onEvent(listener: (event: PedalEvent) => void): () => void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
}
```

---

## 7. Plan de Archivos para la Implementación

### MODIFICAR:
1. `src/types/pedal.ts`:
   * Exportar `PedalEventType`, `PedalEvent`, `PedalTransportType` y `PedalStatus`.
2. `src/hooks/useSongScroll.ts`:
   * Implementar y exportar `goToSongStart` y `goToSongEnd`.
3. `src/components/SongViewer.tsx`:
   * Extraer `goToSongStart` y `goToSongEnd` de `useSongScroll` y pasarlos como props a `PedalHandler`.
4. `src/components/PedalHandler.tsx`:
   * Aceptar `onGoToStart` y `onGoToEnd`.
   * Suscribirse a los eventos unificados de `usePedal()` y delegar la captura Bluetooth en `BluetoothPedalAdapter`.
5. `src/services/PedalService.ts`:
   * Convertir en orquestador/fachada común que gestiona adaptadores activos.
6. `src/hooks/usePedal.ts`:
   * Exponer métodos para cambiar de transporte y escuchar eventos normalizados.

### CREAR:
1. `src/services/pedal/IPedalAdapter.ts`: Interfaz contractual común.
2. `src/services/pedal/WifiPedalAdapter.ts`: Maneja discovery pasivo UDP (4444), conexión TCP (8080) y buffer por líneas `\n`.
3. `src/services/pedal/BluetoothPedalAdapter.ts`: Maneja `TextInput` nativo, keep-alive de foco, mappings SQLite y watchdog de 700 ms para UP/DOWN, emitiendo pulsaciones discretas para HOME (`'h'`) y END (`'e'`).

### NO TOCAR:
* `src/services/DirectorSessionService.ts`
* `src/hooks/useDirectorSession.ts`
* `app/setlist-player/[setlistId].tsx` (Navegación de setlist de director)
* `firmware/Pedal_shifter/src/main.cpp`
* `firmware/pedal_bluetooth/PedalShifter.ino`

---

## 8. Plan de Ejecución Paso a Paso

1. **Paso 1: Tipos y Contratos**
   * Actualizar [`src/types/pedal.ts`](file:///e:/GIOVI/PROGRAMACI%C3%93N/MUSICA/App-cancionero-mobile/src/types/pedal.ts) y crear `IPedalAdapter.ts`.
2. **Paso 2: Métodos de Scroll en `useSongScroll`**
   * Añadir `goToSongStart()` y `goToSongEnd()` a [`src/hooks/useSongScroll.ts`](file:///e:/GIOVI/PROGRAMACI%C3%93N/MUSICA/App-cancionero-mobile/src/hooks/useSongScroll.ts).
3. **Paso 3: Adaptador WiFi**
   * Implementar `WifiPedalAdapter.ts` separando `discover()` de `connect()`.
4. **Paso 4: Adaptador Bluetooth**
   * Implementar `BluetoothPedalAdapter.ts` preservando foco y watchdog de 700 ms.
5. **Paso 5: Fachada `PedalService` y Hook `usePedal`**
   * Unificar el despacho de eventos hacia la aplicación.
6. **Paso 6: Conexión en `PedalHandler` y `SongViewer`**
   * Conectar `HOME` -> `goToSongStart()` y `END` -> `goToSongEnd()`.
7. **Paso 7: Validación de Comportamiento**
   * Verificar que `HOME` lleve a `y = 0` y `END` lleve a `y = maxScrollY`.
   * Verificar que el scroll continuo siga teniendo la misma fluidez y física rAF en Bluetooth y WiFi.
