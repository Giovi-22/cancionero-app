#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>
#include <driver/i2s.h>
#include <math.h>

// ============================================================
// I2S - PCM5102A
// ============================================================

#define I2S_NUM I2S_NUM_0

#define I2S_BCK_IO GPIO_NUM_26
#define I2S_WS_IO GPIO_NUM_25
#define I2S_DO_IO GPIO_NUM_22

// ============================================================
// AUDIO
// ============================================================

const int SAMPLE_RATE = 44100;
const int BUFFER_SIZE = 256;

// Buffer estéreo:
// [L, R, L, R, L, R...]
int16_t samples[BUFFER_SIZE * 2];

// Frecuencia actualmente generada.
// Protegida mediante freqMux porque es compartida
// entre el loop HTTP y la tarea de audio.
float current_frequency = 440.0f;

portMUX_TYPE freqMux = portMUX_INITIALIZER_UNLOCKED;

// ============================================================
// WEB SERVER
// ============================================================

WebServer httpServer(80);

// ============================================================
// PÁGINA WEB
// ============================================================

const char GUITAR_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="es">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>Simulador de Guitarra</title>

  <style>

    body {
      font-family: Arial, sans-serif;
      background: #111;
      color: #fff;
      margin: 0;
      padding: 20px;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 5px;
    }

    h3 {
      color: #aaa;
      font-weight: normal;
      margin-top: 0;
      margin-bottom: 20px;
    }

    .card {
      background: #1d1d1d;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    button {
      width: 100%;
      box-sizing: border-box;
      margin-top: 12px;
      padding: 15px;
      border: none;
      border-radius: 8px;
      background: #3b82f6;
      color: white;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #2563eb;
    }

    button.secondary {
      background: #dc2626;
    }

    button.secondary:hover {
      background: #b91c1c;
    }

    .info {
      color: #aaa;
      font-size: 14px;
      line-height: 1.5;
      margin-top: 15px;
      text-align: center;
    }

  </style>

</head>

<body>

  <div class="container">

    <div class="card">

      <h1>Pedal Simulador</h1>

      <h3>Inyector de frecuencias de guitarra</h3>

      <p
        class="info"
        style="text-align: left; margin-bottom: 10px;"
      >
        Seleccioná una cuerda para inyectar la señal al
        preamplificador:
      </p>

      <button
        type="button"
        onclick="setFrecuencia(82.41)"
      >
        E (6ta Cuerda) - 82.4 Hz
      </button>

      <button
        type="button"
        onclick="setFrecuencia(110.00)"
      >
        A (5ta Cuerda) - 110.0 Hz
      </button>

      <button
        type="button"
        onclick="setFrecuencia(146.83)"
      >
        D (4ta Cuerda) - 146.8 Hz
      </button>

      <button
        type="button"
        onclick="setFrecuencia(196.00)"
      >
        G (3ra Cuerda) - 196.0 Hz
      </button>

      <button
        type="button"
        onclick="setFrecuencia(246.94)"
      >
        B (2da Cuerda) - 246.9 Hz
      </button>

      <button
        type="button"
        onclick="setFrecuencia(329.63)"
      >
        E (1ra Cuerda) - 329.6 Hz
      </button>

      <button
        type="button"
        onclick="setFrecuencia(440.00)"
      >
        La Estándar (A4) - 440.0 Hz
      </button>

      <button
        type="button"
        class="secondary"
        onclick="setFrecuencia(0)"
      >
        MUTEAR SEÑAL
      </button>

      <div id="status" class="info"></div>

    </div>

  </div>

<script>

async function setFrecuencia(frecuencia) {

  const statusContainer =
    document.getElementById("status");

  statusContainer.innerHTML =
    "Cambiando nota...";

  try {

    const response = await fetch(
      "/set?f=" + frecuencia
    );

    if (!response.ok) {
      throw new Error(
        "Error al cambiar frecuencia"
      );
    }

    if (frecuencia === 0) {

      statusContainer.innerHTML =
        "<span style='color: #f87171; font-weight: bold;'>" +
        "Señal Muteada" +
        "</span>";

    } else {

      statusContainer.innerHTML =
        "<span style='color: #4ade80; font-weight: bold;'>" +
        "Inyectando: " +
        frecuencia +
        " Hz" +
        "</span>";

    }

  } catch (error) {

    statusContainer.innerHTML =
      "<p style='color: #f87171;'>" +
      "Error al conectar con la ESP32." +
      "</p>";

    console.error(error);

  }

}

</script>

</body>
</html>
)rawliteral";

// ============================================================
// TAREA DE AUDIO
// ============================================================

void audioTask(void *pvParameters) {

  size_t bytes_written;

  // Fase actual del oscilador.
  float phase = 0.0f;

  while (true) {

    // --------------------------------------------------------
    // Obtener la frecuencia actual de forma segura
    // --------------------------------------------------------

    portENTER_CRITICAL(&freqMux);

    float freq = current_frequency;

    portEXIT_CRITICAL(&freqMux);

    // --------------------------------------------------------
    // SILENCIO
    // --------------------------------------------------------

    if (freq <= 0.0f) {

      memset(samples, 0, sizeof(samples));

      // Reiniciamos la fase para que la próxima nota
      // comience desde el inicio de la onda.
      phase = 0.0f;

    }

    // --------------------------------------------------------
    // GENERACIÓN DE SENO
    // --------------------------------------------------------

    else {

      const float phase_increment = (2.0f * M_PI * freq) / SAMPLE_RATE;

      for (int i = 0; i < BUFFER_SIZE; i++) {

        // Amplitud deliberadamente moderada.
        //
        // int16_t permite aproximadamente:
        // -32768 ... +32767
        //
        // Usamos ±10000 para dejar bastante margen.

        int16_t wave = (int16_t)(sinf(phase) * 10000.0f);

        // Canal izquierdo
        samples[i * 2] = wave;

        // Canal derecho
        samples[i * 2 + 1] = wave;

        // Avanzar fase
        phase += phase_increment;

        // Mantener fase dentro de 0 ... 2PI
        if (phase >= 2.0f * M_PI) {
          phase -= 2.0f * M_PI;
        }
      }
    }

    // --------------------------------------------------------
    // ENVIAR BUFFER AL PCM5102A
    // --------------------------------------------------------

    i2s_write(I2S_NUM, samples, sizeof(samples), &bytes_written, portMAX_DELAY);
  }
}

// ============================================================
// HTTP: PÁGINA PRINCIPAL
// ============================================================

void handleRoot() { httpServer.send(200, "text/html", GUITAR_PAGE); }

// ============================================================
// HTTP: CAMBIAR FRECUENCIA
// ============================================================

void handleSet() {

  if (!httpServer.hasArg("f")) {

    httpServer.send(400, "text/plain", "Falta parametro f");

    return;
  }

  float new_frequency = httpServer.arg("f").toFloat();

  // Validación básica.
  //
  // 0 = silencio
  // >0 = frecuencia válida

  if (new_frequency < 0.0f || new_frequency > 20000.0f) {

    httpServer.send(400, "text/plain", "Frecuencia fuera de rango");

    return;
  }

  // ----------------------------------------------------------
  // Actualizar frecuencia de forma segura
  // ----------------------------------------------------------

  portENTER_CRITICAL(&freqMux);

  current_frequency = new_frequency;

  portEXIT_CRITICAL(&freqMux);

  Serial.printf("Frecuencia cambiada a: %.2f Hz\n", new_frequency);

  httpServer.send(200, "text/plain", "OK");
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(500);

  Serial.println();
  Serial.println("======================================");
  Serial.println(" Generador de frecuencias ESP32");
  Serial.println(" PCM5102A / I2S");
  Serial.println("======================================");

  // ==========================================================
  // CONFIGURACIÓN I2S
  // ==========================================================

  i2s_config_t i2s_config = {

      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),

      .sample_rate = SAMPLE_RATE,

      .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,

      .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,

      .communication_format = I2S_COMM_FORMAT_STAND_I2S,

      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,

      .dma_buf_count = 4,

      .dma_buf_len = BUFFER_SIZE,

      .use_apll = false

  };

  // ==========================================================
  // PINES I2S
  // ==========================================================

  i2s_pin_config_t pin_config = {

      .bck_io_num = I2S_BCK_IO,

      .ws_io_num = I2S_WS_IO,

      .data_out_num = I2S_DO_IO,

      .data_in_num = I2S_PIN_NO_CHANGE

  };

  // Instalar driver I2S

  esp_err_t result = i2s_driver_install(I2S_NUM, &i2s_config, 0, NULL);

  if (result != ESP_OK) {

    Serial.printf("ERROR i2s_driver_install: %d\n", result);

    while (true) {
      delay(1000);
    }
  }

  // Configurar pines

  result = i2s_set_pin(I2S_NUM, &pin_config);

  if (result != ESP_OK) {

    Serial.printf("ERROR i2s_set_pin: %d\n", result);

    while (true) {
      delay(1000);
    }
  }

  // Limpiar DMA

  i2s_zero_dma_buffer(I2S_NUM);

  Serial.println("I2S configurado correctamente.");

  Serial.printf("Sample rate: %d Hz\n", SAMPLE_RATE);

  Serial.printf("BCK: GPIO %d\n", I2S_BCK_IO);

  Serial.printf("WS/LRCK: GPIO %d\n", I2S_WS_IO);

  Serial.printf("DATA: GPIO %d\n", I2S_DO_IO);

  // ==========================================================
  // CREAR RED WI-FI
  // ==========================================================

  WiFi.mode(WIFI_AP);

  bool apStarted = WiFi.softAP("Generador_Guitarra_ESP32", "12345678");

  if (!apStarted) {

    Serial.println("ERROR: No se pudo iniciar el Access Point.");

    while (true) {
      delay(1000);
    }
  }

  Serial.println();
  Serial.println("--- Red Wi-Fi Iniciada ---");

  Serial.println("SSID: Generador_Guitarra_ESP32");

  Serial.println("Clave: 12345678");

  Serial.print("IP del servidor: ");

  Serial.println(WiFi.softAPIP());

  // ==========================================================
  // RUTAS WEB
  // ==========================================================

  httpServer.on("/", handleRoot);

  httpServer.on("/set", handleSet);

  httpServer.begin();

  Serial.println("Servidor HTTP iniciado.");

  // ==========================================================
  // TAREA DE AUDIO
  // ==========================================================

  BaseType_t taskResult =
      xTaskCreatePinnedToCore(audioTask, "AudioTask", 4096, NULL, 5, NULL, 0);

  if (taskResult != pdPASS) {

    Serial.println("ERROR: No se pudo crear AudioTask.");

    while (true) {
      delay(1000);
    }
  }

  Serial.println("AudioTask iniciada en Core 0.");

  Serial.println();
  Serial.println("ESP32 lista.");
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================

void loop() {

  // Procesar peticiones HTTP

  httpServer.handleClient();

  // Pequeña pausa para no ocupar completamente el loop.
  delay(2);
}
