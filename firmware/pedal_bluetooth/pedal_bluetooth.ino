/**
 * Pedal Bluetooth para App Cancionero
 * Dispositivo: NodeMCU ESP-32S V1.1
 * 
 * Configuración de hardware:
 * - Botón Scroll Up (Páginas atrás): Conectado al Pin 17 (P17) y GND (INPUT_PULLUP)
 * - Botón Scroll Down (Páginas adelante): Conectado al Pin 18 (P18) y GND (INPUT_PULLUP)
 * - LED de Estado (Conectividad): Conectado al Pin 16 (P16) con resistencia a GND
 * 
 * Funcionalidad:
 * - Emula un teclado HID Bluetooth llamado "Pedal Cancionero".
 * - LED de estado:
 *   * Parpadeo lento (500ms): Buscando conexión Bluetooth.
 *   * Encendido continuo: Conectado a Bluetooth.
 * - Soporte para dos modos de operación (Alternables presionando ambos botones a la vez por 1.5s):
 *   1. MODO SCROLL (Por defecto):
 *      * P17 presionado: Envía y mantiene presionada la tecla '1'. Al soltar, libera '1'.
 *      * P18 presionado: Envía y mantiene presionada la tecla '2'. Al soltar, libera '2'.
 *      * Indicación LED de activación: 3 destellos rápidos.
 *   2. MODO PÁGINAS:
 *      * P17 presionado: Envía un único pulso de la tecla '3'.
 *      * P18 presionado: Envía un único pulso de la tecla '4'.
 *      * Indicación LED de activación: 1 destello largo (500ms).
 * 
 * Dependencia:
 * Requiere la librería "ESP32-BLE-Keyboard" de T-vK.
 * Enlace: https://github.com/T-vK/ESP32-BLE-Keyboard
 */

#include <BleKeyboard.h>

// Definición de Pines
const int PIN_SCROLL_UP = 17;     // Botón Scroll Up / Retroceso (P17)
const int PIN_SCROLL_DOWN = 18;   // Botón Scroll Down / Avance (P18)
const int PIN_STATUS_LED = 16;    // LED de Estado Bluetooth (P16)

// Instancia del Teclado Bluetooth
BleKeyboard bleKeyboard("Pedal Cancionero", "Giovi", 100);

// Configuración de Modos de Operación
bool isScrollMode = true; // true = Modo Scroll ('1'/'2'), false = Modo Páginas ('3'/'4')

// Estados de botones (para detectar flancos de subida/bajada)
bool btnUpPressed = false;
bool btnDownPressed = false;

// Variables para detección de pulsación doble (Cambio de Modo)
unsigned long doublePressStartTime = 0;
bool doublePressActive = false;
bool ignoreRelease = false;

// Filtro de Rebote (Debounce)
unsigned long lastDebounceTimeUp = 0;
unsigned long lastDebounceTimeDown = 0;
const unsigned long DEBOUNCE_DELAY = 50; // ms de delay para el debounce

bool lastRawUp = HIGH;
bool lastRawDown = HIGH;
bool debouncedUp = HIGH;
bool debouncedDown = HIGH;

// Variables para parpadeo del LED
unsigned long lastLedBlinkTime = 0;
bool ledState = LOW;

void setup() {
  // Inicialización de consola serie para debugging
  Serial.begin(115200);
  Serial.println("[Pedal] Iniciando hardware...");

  // Configuración de Pines
  pinMode(PIN_SCROLL_UP, INPUT_PULLUP);
  pinMode(PIN_SCROLL_DOWN, INPUT_PULLUP);
  pinMode(PIN_STATUS_LED, OUTPUT);

  // Apagar LED al iniciar
  digitalWrite(PIN_STATUS_LED, LOW);

  // Iniciar la emulación del teclado Bluetooth
  bleKeyboard.begin();
  Serial.println("[Pedal] Buscando conexión Bluetooth...");
}

// Función auxiliar para hacer parpadear el LED al cambiar de modo
void signalModeChange(bool scrollMode) {
  digitalWrite(PIN_STATUS_LED, LOW);
  delay(100);
  
  if (scrollMode) {
    // 3 destellos rápidos para indicar Modo Scroll
    for (int i = 0; i < 3; i++) {
      digitalWrite(PIN_STATUS_LED, HIGH);
      delay(80);
      digitalWrite(PIN_STATUS_LED, LOW);
      delay(80);
    }
    Serial.println("[Modo] Cambiado a: MODO SCROLL (Continuo)");
  } else {
    // 1 destello largo de 500ms para indicar Modo Páginas
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(500);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(100);
    Serial.println("[Modo] Cambiado a: MODO PÁGINAS (Pulsación Única)");
  }
}

void loop() {
  unsigned long currentTime = millis();
  bool isConnected = bleKeyboard.isConnected();

  // 1. Control del LED de Conexión
  if (!isConnected) {
    // Parpadeo lento (500ms encendido, 500ms apagado) cuando no hay conexión
    if (currentTime - lastLedBlinkTime >= 500) {
      lastLedBlinkTime = currentTime;
      ledState = !ledState;
      digitalWrite(PIN_STATUS_LED, ledState);
    }
  } else {
    // Encendido permanente cuando está conectado y no se está realizando un cambio de modo
    if (!doublePressActive) {
      digitalWrite(PIN_STATUS_LED, HIGH);
    }
  }

  // Lectura de pines (LOW = Presionado, HIGH = Liberado por resistencia pull-up)
  bool rawUp = digitalRead(PIN_SCROLL_UP);
  bool rawDown = digitalRead(PIN_SCROLL_DOWN);

  // 2. Debounce del Botón Scroll Up (P17)
  if (rawUp != lastRawUp) {
    lastDebounceTimeUp = currentTime;
  }
  if ((currentTime - lastDebounceTimeUp) > DEBOUNCE_DELAY) {
    debouncedUp = rawUp;
  }
  lastRawUp = rawUp;

  // Debounce del Botón Scroll Down (P18)
  if (rawDown != lastRawDown) {
    lastDebounceTimeDown = currentTime;
  }
  if ((currentTime - lastDebounceTimeDown) > DEBOUNCE_DELAY) {
    debouncedDown = rawDown;
  }
  lastRawDown = rawDown;

  // 3. Detección de Doble Pulsación (Cambio de Modo)
  // Si ambos botones se presionan simultáneamente
  if (debouncedUp == LOW && debouncedDown == LOW) {
    if (doublePressStartTime == 0) {
      doublePressStartTime = currentTime;
    } else if (currentTime - doublePressStartTime >= 1500) { // Sostener 1.5 segundos
      if (!doublePressActive) {
        // Alternar el modo
        isScrollMode = !isScrollMode;
        
        // Liberar cualquier tecla sostenida preventivamente
        if (isConnected) {
          bleKeyboard.releaseAll();
        }

        // Mostrar indicación visual en el LED
        signalModeChange(isScrollMode);

        doublePressActive = true;
        ignoreRelease = true; // Prevenir el envío de teclas al soltar los botones
      }
    }
  } else {
    // Si se libera al menos uno, reiniciar el contador
    doublePressStartTime = 0;
    doublePressActive = false;
  }

  // 4. Control de liberación de botones tras un cambio de modo
  if (debouncedUp == HIGH && debouncedDown == HIGH) {
    ignoreRelease = false;
  }

  // 5. Envío de Teclas HID (Solo si está conectado por Bluetooth y no en cambio de modo)
  if (isConnected && !ignoreRelease && !doublePressActive) {
    
    // --- BOTÓN SCROLL UP (PIN 17) ---
    if (debouncedUp == LOW) {
      if (!btnUpPressed) {
        btnUpPressed = true;
        if (isScrollMode) {
          Serial.println("[Teclado] Enviando press('1')");
          bleKeyboard.press('1');
        } else {
          Serial.println("[Teclado] Enviando write('3')");
          bleKeyboard.write('3');
        }
      }
    } else {
      if (btnUpPressed) {
        btnUpPressed = false;
        if (isScrollMode) {
          Serial.println("[Teclado] Enviando release('1')");
          bleKeyboard.release('1');
        }
      }
    }

    // --- BOTÓN SCROLL DOWN (PIN 18) ---
    if (debouncedDown == LOW) {
      if (!btnDownPressed) {
        btnDownPressed = true;
        if (isScrollMode) {
          Serial.println("[Teclado] Enviando press('2')");
          bleKeyboard.press('2');
        } else {
          Serial.println("[Teclado] Enviando write('4')");
          bleKeyboard.write('4');
        }
      }
    } else {
      if (btnDownPressed) {
        btnDownPressed = false;
        if (isScrollMode) {
          Serial.println("[Teclado] Enviando release('2')");
          bleKeyboard.release('2');
        }
      }
    }
  }
}
