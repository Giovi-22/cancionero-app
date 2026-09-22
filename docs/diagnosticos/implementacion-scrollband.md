# Plan técnico — Sincronización de desplazamiento en modo Banda

## Objetivo

Reemplazar la sincronización de scroll de alta frecuencia mediante Firestore por una arquitectura de tiempo real local, manteniendo Firestore para el estado persistente de la sesión.

El objetivo es que:

* El **ESP32** siga siendo únicamente el dispositivo físico de entrada.
* El **Director** sea la autoridad de navegación de la sesión.
* Los **followers** reciban la navegación en tiempo real mediante la red local.
* Firestore deje de recibir escrituras continuas durante el scroll.
* Los followers puedan mantener un desplazamiento fluido y sincronizado.
* La arquitectura quede preparada para futuras funciones de tiempo real.

---

# 1. Arquitectura objetivo

```text
                         ┌─────────────────────┐
                         │      Firestore      │
                         │                     │
                         │ Sesión              │
                         │ Canción             │
                         │ Setlist             │
                         │ Checkpoint          │
                         │ Miembros             │
                         └──────────┬──────────┘
                                    │
                              estado persistente
                                    │
                                    ▼
┌─────────────┐             ┌──────────────────┐
│             │    TCP      │                  │
│    ESP32    │ ───────────► │     DIRECTOR     │
│             │   8080       │                  │
└─────────────┘              │ PedalService     │
                             │       ↓          │
                             │ SongViewer       │
                             │       ↓          │
                             │ Realtime Server  │
                             └────────┬─────────┘
                                      │
                              LAN realtime
                                      │
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
                  ┌─────────┐   ┌─────────┐   ┌─────────┐
                  │Follower │   │Follower │   │Follower │
                  │    1    │   │    2    │   │    3    │
                  └─────────┘   └─────────┘   └─────────┘
```

## Principio fundamental

El ESP32 **no conoce**:

* canciones
* posiciones
* sesiones
* bandas
* usuarios
* Firestore

El ESP32 solamente genera:

```text
UP_PRESS
UP_RELEASE
DOWN_PRESS
DOWN_RELEASE
HOME
END
```

La inteligencia permanece en la aplicación.

---

# 2. Problema actual

Actualmente el flujo de scroll es aproximadamente:

```text
ESP32
  ↓
Director
  ↓
useSongScroll
  ↓
SCROLL_POSITION
  ↓
Firestore
  ↓
Follower
  ↓
scrollTo()
```

La posición se está enviando aproximadamente cada 100 ms.

Esto convierte Firestore en un canal de streaming de alta frecuencia.

### Problemas

* demasiadas escrituras
* demasiadas lecturas
* latencia variable
* jitter
* acumulación de eventos
* replay de eventos antiguos al reconectar
* falta de sequence number
* diferencias de scroll entre dispositivos
* dependencia innecesaria de Internet/Firestore para una comunicación que debería ser local

---

# 3. Arquitectura propuesta

Separar claramente dos responsabilidades.

## Pedal

```text
usePedal()
    ↓
PedalService
    ↓
WifiPedalAdapter / BluetoothPedalAdapter
    ↓
ESP32
```

Esta arquitectura ya está definida y debe mantenerse.

## Sincronización de banda

Crear una capa independiente:

```text
useBandRealtime()
        ↓
BandRealtimeService
        ↓
DirectorRealtimeServer
        ↓
Followers
```

El código relacionado con el realtime de banda **no debe entrar dentro de PedalService**.

PedalService solamente entrega eventos del pedal.

---

# 4. Responsabilidades

## ESP32

Responsabilidad:

> Detectar botones y transmitir eventos.

No debe modificarse para conocer el estado de la canción.

Actualmente TCP 8080 es suficiente.

No migrar a WebSocket ni modificar el protocolo del pedal salvo que una necesidad concreta lo justifique.

---

## Director

El Director es la autoridad.

Recibe:

```text
UP_PRESS
UP_RELEASE
DOWN_PRESS
DOWN_RELEASE
HOME
END
```

y modifica su propio estado de navegación.

Además transmite el estado de navegación a los followers.

---

## Followers

Los followers:

1. se conectan explícitamente al Director
2. reciben el estado inicial
3. reciben actualizaciones de navegación
4. interpolan localmente
5. corrigen pequeños desfasajes
6. reciben saltos discretos como HOME/END

Los followers **no deberían ejecutar su propio scroll autónomo independiente durante períodos largos sin corrección**.

---

# 5. No enviar 60 FPS por red

No enviar:

```text
SCROLL_POSITION
SCROLL_POSITION
SCROLL_POSITION
SCROLL_POSITION
...
```

a cada frame.

La aplicación debe continuar usando:

```text
requestAnimationFrame
```

para conseguir movimiento fluido localmente.

La red solamente transmite suficiente información para que cada dispositivo pueda reconstruir el movimiento.

---

# 6. Modelo de sincronización

Se propone un paquete similar a:

```ts
interface NavigationSyncPacket {
  seq: number;
  timestamp: number;

  type: 'MOTION' | 'ANCHOR' | 'JUMP';

  progress: number;

  velocity: number;

  direction: 'up' | 'down' | 'none';
}
```

## `seq`

Número incremental del estado.

Ejemplo:

```text
101
102
103
104
```

Permite detectar:

* paquetes fuera de orden
* paquetes perdidos
* reconexiones
* estados antiguos

---

## `timestamp`

Timestamp generado por el Director.

Sirve para estimar cuánto tiempo pasó desde que se produjo el estado.

---

## `progress`

Posición normalizada:

```text
0.0 → inicio
1.0 → final
```

Debe mantenerse como concepto de estado/checkpoint, pero no necesariamente como único mecanismo de sincronización.

---

## `velocity`

Velocidad actual del desplazamiento.

Ejemplo conceptual:

```text
velocity = 0.35
```

El valor exacto deberá definirse durante la implementación.

---

## `direction`

```ts
'up'
'down'
'none'
```

Permite reconstruir el movimiento.

---

# 7. Tipos de mensajes

## MOTION

Movimiento continuo.

Ejemplo:

```json
{
  "type": "MOTION",
  "seq": 152,
  "timestamp": 123456789,
  "progress": 0.423,
  "velocity": 0.31,
  "direction": "down"
}
```

No significa:

> "andá exactamente a esta posición y quedate ahí".

Significa:

> "en este instante, el Director está aproximadamente acá y se está moviendo en esta dirección a esta velocidad".

El follower continúa el movimiento localmente.

---

# 8. ANCHOR

Corrección periódica.

Ejemplo:

```json
{
  "type": "ANCHOR",
  "seq": 160,
  "timestamp": 123456999,
  "progress": 0.438,
  "velocity": 0.31,
  "direction": "down"
}
```

El follower compara su posición estimada con la posición recibida.

Si la diferencia es pequeña:

```text
corrección suave
```

Si la diferencia es grande:

```text
corrección más fuerte
```

No se debería hacer un `scrollTo()` brusco ante cada paquete.

---

# 9. JUMP

Para acciones discretas.

Por ejemplo:

```text
HOME
END
```

El Director puede enviar:

```json
{
  "type": "JUMP",
  "seq": 200,
  "timestamp": 123458000,
  "progress": 0,
  "velocity": 0,
  "direction": "none"
}
```

El follower realiza el salto inmediatamente.

---

# 10. Frecuencia de sincronización

No transmitir cada frame.

Como punto inicial de implementación:

```text
5–10 actualizaciones por segundo
```

y dejar:

```text
requestAnimationFrame
```

para el movimiento local.

Este valor debe medirse y ajustarse durante las pruebas.

No asumir de antemano que 5 Hz o 10 Hz es necesariamente el valor definitivo.

---

# 11. Firestore

Firestore debe conservar su función de persistencia.

Puede almacenar:

```text
band
session
setlist
currentSong
session state
checkpoint
director
members
```

Pero no debe almacenar:

```text
cada movimiento del scroll
cada frame
cada 100 ms de posición
```

---

# 12. Reconexión

Cuando un follower se conecta:

```text
FOLLOWER
   ↓
CONNECT
   ↓
DIRECTOR
   ↓
INITIAL_STATE
   ↓
FOLLOWER
```

El Director debe enviar inmediatamente el estado actual.

Por ejemplo:

```json
{
  "type": "ANCHOR",
  "seq": 500,
  "timestamp": 123460000,
  "progress": 0.62,
  "velocity": 0,
  "direction": "none"
}
```

El follower no necesita reproducir todos los estados anteriores.

Esto elimina el problema actual de Firestore de replayar eventos históricos.

---

# 13. Descubrimiento

El Director deberá iniciar un servidor realtime local.

Los followers deberán poder descubrirlo.

La conexión debe ser explícita:

```text
Pedal encontrado
      ↓
Director encontrado
      ↓
Usuario decide conectarse
      ↓
Conectar
```

No hacer:

```text
Director detectado
      ↓
conectar automáticamente
```

La decisión de conexión debe quedar en manos del usuario.

---

# 14. Seguridad / autenticación

No asumir que cualquier dispositivo conectado a la misma WiFi puede enviar comandos.

El protocolo deberá tener algún mecanismo de identificación/autorización.

Una opción:

```text
Firestore
   ↓
session token
   ↓
Director
   ↓
Follower
```

El Director acepta únicamente followers autorizados para esa sesión.

Esto debe diseñarse antes de implementar el servidor definitivo.

---

# 15. Transporte

La primera opción a evaluar:

```text
TCP
```

porque:

* ya utilizamos TCP con el ESP32
* garantiza orden
* simplifica el protocolo
* la cantidad de datos es pequeña
* no necesitamos streaming de video/audio

No migrar automáticamente a WebSocket.

Primero comprobar qué puede hacer cómodamente:

```text
react-native-tcp-socket
```

en Android e iOS para actuar como servidor/cliente.

UDP puede mantenerse como mecanismo de descubrimiento si resulta conveniente.

---

# 16. Posible arquitectura de módulos

Una estructura futura podría ser:

```text
services/
  pedal/
    PedalService.ts
    WifiPedalAdapter.ts
    BluetoothPedalAdapter.ts

  band/
    BandRealtimeService.ts
    DirectorRealtimeServer.ts
    FollowerRealtimeClient.ts
    BandRealtimeProtocol.ts
```

Hooks:

```text
hooks/
  usePedal.ts
  useBandRealtime.ts
```

La pantalla debería mantenerse delgada.

---

# 17. SongViewer

Actualmente SongViewer conoce demasiado del mecanismo de sincronización.

La intención futura es llevarlo hacia algo conceptualmente similar a:

```tsx
const {
  isConnected,
  connectionState,
  syncState,
  connect,
  disconnect,
} = useBandRealtime();
```

SongViewer debería preocuparse principalmente por:

```text
renderizar canción
scroll local
recibir estado de navegación
```

y no por:

```text
TCP
Firestore
socket
protocolos
sequence numbers
```

---

# 18. useSongScroll

`useSongScroll` debe continuar siendo responsable del movimiento local.

No convertirlo en un servicio de red.

Su responsabilidad debería ser:

```text
scroll local
↓
posición
↓
velocidad
↓
estado de movimiento
```

La capa realtime decide cuándo publicar un nuevo estado.

---

# 19. Geometría del documento

Hay un problema importante que no debe olvidarse.

Dos dispositivos pueden tener:

* distinto tamaño de pantalla
* distinto fontSize
* distinto line spacing
* distinto viewMode
* distinto viewport

Por lo tanto:

```text
progress = 0.50
```

no necesariamente representa exactamente la misma posición visual.

Para conseguir una sincronización realmente consistente en modo banda, posiblemente haya que controlar o normalizar algunos parámetros visuales.

Por ejemplo:

```text
fontSize
lineSpacing
viewMode
```

Esto debe investigarse antes de considerar terminada la sincronización.

---

# 20. Lo que NO hacer

No implementar:

```text
ESP32 → todos los teléfonos directamente
```

como solución principal.

Aunque técnicamente puede funcionar, no resuelve por sí mismo el problema de sincronización.

Si cada teléfono recibe:

```text
DOWN_PRESS
```

y ejecuta su propio:

```text
requestAnimationFrame
```

cada dispositivo puede desplazarse a una velocidad ligeramente diferente.

Después de varios segundos aparecerá drift.

El problema no es únicamente el transporte del evento.

El problema es mantener un **estado temporal común**.

---

# 21. Pruebas necesarias

Antes de eliminar definitivamente la sincronización Firestore, probar:

### Prueba 1 — un Director + un follower

```text
ESP32
 ↓
Director
 ↓
Follower
```

Medir:

* latencia percibida
* suavidad
* drift
* reconexión

### Prueba 2 — un Director + 3 followers

Verificar que todos reciban el mismo estado.

### Prueba 3 — reconexión

Desconectar un follower durante varios segundos.

Al volver:

```text
CONNECT
↓
INITIAL_STATE
↓
SYNC
```

Debe recuperar la posición actual sin reproducir eventos antiguos.

### Prueba 4 — HOME / END

Verificar sincronización inmediata.

### Prueba 5 — cambio de canción

El cambio de canción debe continuar siendo una operación de sesión y no una operación del ESP32.

### Prueba 6 — red problemática

Probar:

* WiFi doméstico
* hotspot
* red empresarial

Especialmente porque ya se detectó que determinadas redes pueden impedir comunicación entre dispositivos.

---

# 22. Criterio de éxito

La implementación puede considerarse correcta cuando:

* Firestore no recibe escrituras continuas durante el scroll.
* El Director mantiene el movimiento local fluido.
* Los followers se mueven de forma fluida.
* El drift se mantiene pequeño durante sesiones largas.
* HOME/END se sincronizan inmediatamente.
* Un follower que se reconecta recupera el estado actual.
* Un usuario decide explícitamente conectarse al Director.
* El ESP32 continúa siendo independiente de la lógica de banda.
* Personal mode continúa funcionando igual que antes.
* `usePedal()` sigue siendo la API pública única del pedal.
* SongViewer no conoce detalles de TCP/Firestore.

---

# 23. Orden recomendado de implementación

Cuando retomemos este trabajo, hacerlo en este orden:

### Fase 1 — Diagnóstico final

Revisar:

```text
useSongScroll
SongViewer
useDirectorSession
DirectorSessionService
setlist-player/[setlistId]
react-native-tcp-socket
app.config.js
Android permissions
iOS Local Network permissions
```

No modificar todavía.

---

### Fase 2 — Diseñar protocolo

Definir definitivamente:

```ts
NavigationSyncPacket
```

y los mensajes:

```text
HELLO
WELCOME
MOTION
ANCHOR
JUMP
SONG_CHANGED
SESSION_STATE
PING
PONG
```

---

### Fase 3 — Director realtime

Crear:

```text
DirectorRealtimeServer
```

Primero probarlo sin SongViewer.

---

### Fase 4 — Follower realtime

Crear:

```text
FollowerRealtimeClient
```

y comprobar conexión entre dos teléfonos.

---

### Fase 5 — Integrar navegación

Conectar:

```text
SongViewer
      ↓
useBandRealtime
      ↓
RealtimeService
```

---

### Fase 6 — Integrar interpolación

Reemplazar:

```text
scrollTo(progress)
```

continuo por:

```text
estado de movimiento
+
requestAnimationFrame
+
correcciones periódicas
```

---

### Fase 7 — Sacar scroll de Firestore

Eliminar únicamente la parte de:

```text
SCROLL_POSITION
```

que actualmente genera escrituras continuas.

Mantener Firestore para:

```text
session
song
setlist
checkpoint
```

---

### Fase 8 — Reconexión y seguridad

Agregar:

```text
initial state
sequence numbers
session authentication
reconnect
timeout
```

---

### Fase 9 — Pruebas reales

Probar con:

```text
ESP32
+
Director
+
2/3 teléfonos
```

en una red local real.

---

# Estado actual

**No implementar todavía.**

El sistema actual debe permanecer funcionando mientras se resuelve la otra prioridad.

Cuando se retome este documento, el primer paso será realizar el **Diagnóstico Final de Fase 1**, sin modificar código.

El objetivo es confirmar la arquitectura real existente antes de comenzar cualquier refactor.
