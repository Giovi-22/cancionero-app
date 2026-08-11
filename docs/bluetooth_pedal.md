# Pedal Bluetooth — Documentación Técnica

> Última actualización: 2026-06-25

---

## 1. Arquitectura General

El pedal es un **ESP32 NodeMCU** que emula un **teclado HID Bluetooth** usando la librería `BleKeyboard`. El celular lo ve exactamente igual que un teclado físico conectado por Bluetooth. No se usa ninguna librería nativa especial en la app; toda la captura se hace mediante un `TextInput` oculto que mantiene el foco.

```
[Botón Físico]
      │
      ▼
[ESP32 NodeMCU]  ──(BLE HID)──▶  [Sistema Operativo Android]
                                          │
                                          ▼
                                  [TextInput Oculto]
                                  onKeyPress + onChangeText
                                          │
                                          ▼
                              [PedalHandler / pedal-config]
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                       [SongViewer]           [StorageService]
                    Scroll Continuo          Guarda mapeos en
                    Siguiente/Anterior         SQLite (pedal_mappings)
```

---

## 2. Hardware — ESP32 (PedalBluetooth.ino)

### Pines
| Pin | Botón | Descripción |
|-----|-------|-------------|
| 17 | Izquierdo | Scroll Arriba / Página Anterior |
| 16 | Medio | **Cambio de Modo** (Scroll ↔ Páginas) |
| 18 | Derecho | Scroll Abajo / Página Siguiente |

Todos con `INPUT_PULLUP` (el botón conecta a GND al presionar → `LOW` = presionado).

### Modos de Operación

El botón del **medio** alterna entre dos modos:

#### Modo SCROLL (por defecto, `modoScroll = true`)
Usa `bleKeyboard.press()` / `bleKeyboard.release()` para mantener la tecla enviada mientras el botón esté apretado:

```cpp
// Botón Izquierdo = Scroll Arriba
if (botonIzquierdoState == LOW && !upPressed) {
    bleKeyboard.press('1');   // Tecla '1' sostenida
    upPressed = true;
}
if (botonIzquierdoState == HIGH && upPressed) {
    bleKeyboard.release('1'); // Suelta la tecla
    upPressed = false;
}

// Botón Derecho = Scroll Abajo
// Igual pero con '2'
```

> **Por qué `press()`/`release()` para scroll:** Mientras la tecla está sostenida, el SO genera eventos de tecla repetidos automáticamente (~20 eventos/seg). La app los recibe como una ráfaga continua y los convierte en scroll fluido.

#### Modo PÁGINAS (`modoScroll = false`)
Usa `bleKeyboard.write()` que envía un único pulso (presionar + soltar) por toque:

```cpp
// Botón Izquierdo = Página Anterior
if (lastBotonIzquierdoState == HIGH && botonIzquierdoState == LOW) {
    bleKeyboard.write('3');   // Un solo evento
    delay(150);
}

// Botón Derecho = Página Siguiente
// Igual pero con '4'
```

> **Por qué caracteres `'1'`/`'2'`/`'3'`/`'4'` en lugar de flechas:** Android y iOS a veces filtran las teclas de navegación (`KEY_UP_ARROW`, etc.) para uso de accesibilidad en lugar de pasarlas a la app. Los caracteres alfanuméricos nunca se filtran y se pueden verificar fácilmente en cualquier campo de texto.

### Resumen de Teclas Emitidas
| Botón | Modo Scroll | Modo Páginas |
|-------|-------------|--------------|
| Izquierdo | `'1'` (continuo) | `'3'` (único) |
| Derecho | `'2'` (continuo) | `'4'` (único) |
| Medio | Cambia modo | Cambia modo |

---

## 3. Emparejamiento Bluetooth

### Problema común: el pedal se conecta a la PC antes que al celular
El ESP32 recuerda el último dispositivo emparejado y se conecta automáticamente. Si la PC tiene Bluetooth activo, la toma primero.

**Solución:** Apagar el Bluetooth de la PC antes de encender el pedal, o desconectar el dispositivo desde Windows.

### Pasos para parear con el celular por primera vez
1. Ir a **Ajustes → Bluetooth** en el celular.
2. Si ya existe `"Pedal Cancionero"`, seleccionarlo y elegir **"Olvidar"**.
3. Apagar y encender el Bluetooth del celular.
4. Reiniciar el ESP32 (botón `RST`).
5. Buscar dispositivos nuevos en el celular → seleccionar `"Pedal Cancionero"`.
6. El celular debe mostrar un **ícono de teclado** junto al nombre, indicando que lo reconoció como dispositivo de entrada.

### Verificar que funciona (antes de probar en la app)
Abrir cualquier campo de texto (Google Docs, WhatsApp, bloc de notas) y pisar los botones del pedal. Deben aparecer los caracteres `1`, `2`, `3` o `4` escritos en el texto.

---

## 4. App — Captura de Teclas

### Estrategia Dual Listener (onKeyPress + onChangeText)

Android tiene un comportamiento inconsistente con teclados físicos:
- `onKeyPress` captura teclas de sistema (flechas, Enter, Escape) pero **a veces no captura letras/números**.
- `onChangeText` captura letras/números pero **no captura teclas de sistema**.

La app usa **ambos eventos en paralelo** con un debounce de 150ms para evitar duplicados:

```typescript
const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

const handleKeyDetected = (key: string) => {
    const now = Date.now();
    // Ignorar si el mismo key llegó hace menos de 150ms (duplicado)
    if (lastKeyRef.current.key === key && (now - lastKeyRef.current.time) < 150) return;
    lastKeyRef.current = { key, time: now };
    // ... ejecutar acción
};

const handleKeyPress = (e: any) => handleKeyDetected(e.nativeEvent.key);
const handleTextChange = (text: string) => {
    if (text?.length > 0) handleKeyDetected(text.charAt(text.length - 1));
};
```

### Problema de Foco en Android

Un `TextInput` invisible (`opacity: 0`, `top: -100`) es descartado por Android como "no renderizable" y no recibe eventos de teclado. La solución es mantenerlo **técnicamente en pantalla** pero invisible al ojo humano:

```typescript
// ✅ Correcto — Android lo considera visible
hiddenInput: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    opacity: 0.01,         // casi invisible pero renderizable
    color: 'transparent',
    backgroundColor: 'transparent',
}

// ❌ Incorrecto — Android ignora el foco
hiddenInput: {
    position: 'absolute',
    top: -100,  // fuera de pantalla
    opacity: 0,
}
```

Un `setInterval` de 1 segundo re-enfoca el input si Android lo pierde (por ejemplo, al minimizar y restaurar la app):

```typescript
useEffect(() => {
    const interval = setInterval(() => {
        if (inputRef.current && !inputRef.current.isFocused()) {
            inputRef.current.focus();
        }
    }, 1000);
    return () => clearInterval(interval);
}, [enabled]);
```

### Problema del Modal que roba el foco

El componente `<Modal>` nativo de React Native en Android **siempre roba el foco** del `TextInput` padre. Se reemplazó por un `<View>` posicionado de forma absoluta que simula el modal sin crear una nueva actividad nativa:

```tsx
// ❌ Roba el foco — TextInput deja de recibir teclas
<Modal visible={listeningAction !== null} transparent>
    ...
</Modal>

// ✅ No roba el foco — mismo árbol de componentes
{listeningAction !== null && (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, ... }}>
        ...
    </View>
)}
```

---

## 5. App — Scroll Continuo (SongViewer.tsx)

### Mecanismo de Auto-Stop

El scroll continuo se implementa con un patrón de **intervalo + timer de auto-stop**:

```typescript
const pedalIntervalRef = useRef<any>(null);      // intervalo de scroll activo
const isPedalScrollingRef = useRef(false);        // flag de estado
const pedalScrollStopTimer = useRef<any>(null);   // timer de auto-stop

const triggerContinuousScroll = useCallback((direction: 'up' | 'down') => {
    // 1. Scroll inmediato en el primer evento
    const step = SCREEN_HEIGHT * 0.05 * pedalSpeed;
    const nextY = direction === 'down'
        ? scrollPosRef.current + step
        : Math.max(0, scrollPosRef.current - step);
    scrollRef.current?.scrollTo({ y: nextY, animated: false });
    scrollPosRef.current = nextY;

    // 2. Iniciar intervalo si no está corriendo
    if (!isPedalScrollingRef.current) {
        isPedalScrollingRef.current = true;
        pedalIntervalRef.current = setInterval(() => {
            const s = SCREEN_HEIGHT * 0.05 * pedalSpeed;
            const y = direction === 'down'
                ? scrollPosRef.current + s
                : Math.max(0, scrollPosRef.current - s);
            scrollRef.current?.scrollTo({ y, animated: false });
            scrollPosRef.current = y;
        }, 60); // ~16 FPS
    }

    // 3. Reiniciar timer de auto-stop
    if (pedalScrollStopTimer.current) clearTimeout(pedalScrollStopTimer.current);
    pedalScrollStopTimer.current = setTimeout(() => {
        clearInterval(pedalIntervalRef.current);
        pedalIntervalRef.current = null;
        isPedalScrollingRef.current = false;
    }, 200); // Detener si no llega ningún evento en 200ms
}, [pedalSpeed, SCREEN_HEIGHT]);
```

### Flujo del Scroll Continuo Paso a Paso

```
[Botón presionado]
        │
        ▼
ESP32 envía bleKeyboard.press('2')
        │
        ▼
SO genera evento de tecla repetido cada ~50ms
        │
        ▼  (primer evento)
handleKeyDetected('2')
 → Scroll inmediato (5% de pantalla)
 → Arranca setInterval cada 60ms
 → Inicia timer auto-stop 200ms
        │
        ▼  (eventos subsiguientes del OS)
handleKeyDetected('2')  (cada ~50ms del key repeat)
 → Reinicia timer auto-stop 200ms ← ← ← ← ←
        │                                      │
        │  [Botón suelto → SO deja de enviar]  │
        ▼                                      │
Timer de 200ms expira sin ser reiniciado ──────┘
 → clearInterval
 → isPedalScrollingRef = false
 → Scroll se detiene
```

### Parámetros Ajustables

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `step` | `SCREEN_HEIGHT * 0.05 * pedalSpeed` | Distancia de scroll por intervalo |
| Intervalo | `60ms` | Frecuencia del scroll (~16 FPS) |
| Auto-stop | `200ms` | Tiempo sin eventos para detener |
| `pedalSpeed` | `0.1 – 2.0` (configurable en ajustes) | Multiplicador de velocidad |

---

## 6. App — Pantalla de Configuración (pedal-config.tsx)

### Acceso
`Configuración (tab) → Pedal Bluetooth`

### Funcionalidades

#### Indicador de Estado de Foco
Una tarjeta en la parte superior muestra si el detector está **activo (verde)** o **inactivo (rojo)**.
- Si está en rojo, tocar la tarjeta re-enfoca el `TextInput` y lo activa.

#### Detector en Tiempo Real
Un panel que muestra instantáneamente:
- La **tecla detectada** (ej. `"2"`, `"ArrowDown"`)
- La **acción asignada** (ej. `"Scroll Abajo"`) o "Sin asignar" en rojo

#### Asignación de Teclas (Modo Aprender)
1. Tocar el botón **"Mapear"** o **"Reasignar"** junto a una acción.
2. Aparece un overlay (implementado como `<View>` absoluto, no `<Modal>`, para no perder el foco).
3. Presionar el botón del pedal físico.
4. El mapeo se guarda automáticamente en SQLite y se cierra el overlay.

#### Restaurar Valores por Defecto
Botón **"Valores por defecto"** que restablece el mapeo estándar.

### Almacenamiento
Los mapeos se guardan en la tabla `settings` de SQLite bajo la clave `'pedal_mappings'`:

```typescript
// Estructura del objeto guardado
{
  "1": "scroll_up",
  "2": "scroll_down",
  "3": "prev_page",
  "4": "next_page"
}

// API
await StorageService.saveSetting('pedal_mappings', mappings);
const saved = await StorageService.getSetting<Record<string, string>>('pedal_mappings');
```

### Acciones Disponibles
| ID | Nombre | Descripción |
|----|--------|-------------|
| `scroll_up` | Scroll Arriba | Scroll continuo hacia arriba |
| `scroll_down` | Scroll Abajo | Scroll continuo hacia abajo |
| `next_page` | Siguiente Canción | Avanza en la lista del setlist |
| `prev_page` | Anterior Canción | Retrocede en la lista del setlist |
| `toggle_autoscroll` | Iniciar/Parar Scroll | Activa/desactiva el auto-scroll |

---

## 7. App — PedalHandler.tsx

Componente invisible que se monta dentro de `SongViewer`. Solo está activo cuando:
- `isStageMode === true` (modo escenario activo)
- `isSettingsOpen === false` (el panel de ajustes está cerrado)

Al montarse, carga los mapeos desde `StorageService` y los aplica dinámicamente.

```tsx
<PedalHandler
    onNext={onDirectorNext}
    onPrev={onDirectorPrev}
    onScrollUp={handlePedalScrollUp}
    onScrollDown={handlePedalScrollDown}
    onToggleAutoScroll={() => setIsScrolling(p => !p)}
    enabled={isStageMode && !isSettingsOpen}
/>
```

---

## 8. Solución de Problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| Consola Arduino dice "Bluetooth NO conectado" | Nadie está conectado | Emparejar el celular con `"Pedal Cancionero"` |
| Consola dice "conectado" pero no escribe en ninguna app | Se conectó a la PC | Apagar Bluetooth de la PC |
| Escribe en WhatsApp pero la app no detecta | Foco perdido en el TextInput | Tocar la tarjeta verde/roja en la pantalla de configuración |
| Detecta en configuración pero no en SongViewer | `isStageMode` está desactivado | Activar el modo escenario (ícono de pantalla completa) |
| Scroll funciona pero con delay inicial | Key repeat delay del SO (~500ms) | Normal; el SO tarda en comenzar el repeat |
| Scroll no se detiene | Timer de auto-stop no se ejecuta | Verificar que no haya otro evento bloqueando el hilo JS |
