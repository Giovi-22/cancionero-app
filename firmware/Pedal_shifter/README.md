# Pedal Cancionero - firmware modular

Esta carpeta contiene los archivos fuente para reemplazar/agregar dentro
del `src/` de un proyecto PlatformIO existente.

## Estructura

- `main.cpp`: composición de módulos y ciclo principal.
- `config/`: configuración persistente.
- `input/`: botones y máquina de estados.
- `bluetooth/`: Bluetooth HID.
- `wifi/`: conexión WiFi y AP.
- `network/`: servidor TCP 8080 y UDP discovery 4444.
- `output/`: distribución de eventos a BLE y TCP.
- `web/`: dashboard responsive y API HTTP.
- `hardware/`: LED de estado.
- `tuner/`: punto de extensión futuro; todavía sin implementación.

## Importante

No reemplazar `platformio.ini` si el proyecto existente ya compila.

Este código utiliza ArduinoJson para la API JSON. Si la dependencia no está
presente en el proyecto existente, agregar `bblanchon/ArduinoJson`.

El protocolo del pedal se mantiene:

TCP:
UP_PRESS
UP_RELEASE
DOWN_PRESS
DOWN_RELEASE
HOME
END

Bluetooth HID:
UP = '1'
DOWN = '2'
HOME = 'h'
END = 'e'

El GPIO 4 ya NO se utiliza para seleccionar Bluetooth/WiFi.
