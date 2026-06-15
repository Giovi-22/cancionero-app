# Plan de Implementación: Pedal Bluetooth

La gran mayoría de los pedales "Bluetooth" para músicos (como los AirTurn, PageFlip o genéricos chinos) **funcionan en realidad como teclados inalámbricos convencionales (HID)**. No requieren un escaneo de dispositivos Bluetooth complejo; se emparejan desde los ajustes del sistema operativo (Android/iOS) y emiten "pulsaciones de teclas" (ej. Flecha Arriba, Flecha Abajo, Avance de Página, Espacio, etc.).

El objetivo es interceptar estas teclas a nivel global en la app y traducirlas a acciones (Scroll, Siguiente Canción).

## Fase 1: Captura de Eventos de Teclado (Hardware)
Para escuchar eventos de un teclado de hardware globalmente sin necesidad de tener un "campo de texto" seleccionado, necesitamos una librería nativa.
- **Librería a usar**: `react-native-keyevent`.
- **Requisito**: Al ser código nativo, si estás usando "Expo Go" actualmente, tendremos que compilar una "Development Build" (`npx expo run:android`), que es tu propia versión de Expo Go personalizada con este módulo adentro.
- **Implementación**: Iniciar un listener global en la raíz de la app (`_layout.tsx`) que capture códigos de teclas (ej. `keyCode: 19` para Arriba).

## Fase 2: Lógica y Persistencia de Mapeo
En lugar de tener acciones fijas, permitiremos que presiones cualquier pedal y le asignes una acción.
- Ampliar `StorageService.ts` para guardar un objeto `pedal_mapping` (ej. `{ "keyCode_19": "SCROLL_UP", "keyCode_20": "SCROLL_DOWN" }`).
- En la pantalla `app/pedal-config.tsx`, agregar un botón "Asignar Pedal". Al tocarlo, la app se pone en modo "escucha", presionás el pedal físico, la app detecta qué código envió, y te pregunta qué acción asignarle.

## Fase 3: Integración en la Interfaz (Pantallas Vivas)
- **AppContext**: Crear un estado global `pedalAction` o registrar callbacks.
- **SongViewer**: Escuchar las acciones de pedal.
  - Si llega `SCROLL_DOWN`, utilizar el ref del `ScrollView` para bajar una porción de la pantalla (`scrollViewRef.current.scrollTo({ y: currentY + 300, animated: true })`).
  - Si llega `NEXT_SONG`, avanzar a la siguiente canción de la lista (ideal para el `SetlistsScreen` en vivo).

---

### Preguntas para vos:
1. **Compilación Nativa**: ¿Estás usando actualmente la aplicación azul de "Expo Go" en tu celular, o tenés una compilación personalizada (apk)? Instalar `react-native-keyevent` requiere hacer un build propio.
2. **Acciones**: ¿Además de "Scroll Abajo", "Scroll Arriba", "Siguiente Tema" y "Tema Anterior", se te ocurre alguna otra acción útil para mapear? (ej. Iniciar/Parar auto-scroll si alguna vez lo implementamos).
