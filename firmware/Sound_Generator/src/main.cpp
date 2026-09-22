#include "driver/i2s.h"
#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <math.h>


#define I2S_NUM I2S_NUM_0
#define I2S_BCK_IO GPIO_NUM_26
#define I2S_WS_IO GPIO_NUM_25
#define I2S_DO_IO GPIO_NUM_22

const int SAMPLE_RATE = 44100;
const int BUFFER_SIZE = 256;
int16_t samples[BUFFER_SIZE * 2];

// Variables globales para el manejo dinámico de la frecuencia
volatile float current_frequency = 440.0f;
portMUX_TYPE freqMux = portMUX_INITIALIZER_UNLOCKED;

// Servidor Web en el puerto 80
AsyncWebServer server(80);

// Tarea en segundo plano para el audio (Core 0)
void audioTask(void *pvParameters) {
  size_t bytes_written;
  float phase = 0.0f;

  while (1) {
    portENTER_CRITICAL(&freqMux);
    float freq = current_frequency;
    portEXIT_CRITICAL(&freqMux);

    // Si la frecuencia es 0, enviamos silencio absoluto
    if (freq == 0.0f) {
      memset(samples, 0, sizeof(samples));
    } else {
      float phase_increment = (2.0f * M_PI * freq) / SAMPLE_RATE;
      for (int i = 0; i < BUFFER_SIZE; i++) {
        int16_t wave =
            (int16_t)(sin(phase) * 25000.0f); // Amplitud alta y segura
        samples[i * 2] = wave;                // Izquierdo
        samples[i * 2 + 1] = wave;            // Derecho

        phase += phase_increment;
        if (phase >= 2.0f * M_PI) {
          phase -= 2.0f * M_PI;
        }
      }
    }
    // Escritura directa por DMA
    i2s_write(I2S_NUM, samples, sizeof(samples), &bytes_written, portMAX_DELAY);
  }
}

// Interfaz Web embebida (HTML puro)
const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Simulador de Guitarra I2S</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; background: #1e1e24; color: #fff; padding-top: 30px; }
        h1 { color: #00ffcc; }
        .btn { display: inline-block; width: 140px; margin: 10px; padding: 15px; font-size: 16px; font-weight: bold; background: #3a3a43; border: 2px solid #00ffcc; color: #fff; border-radius: 8px; cursor: pointer; transition: 0.3s; }
        .btn:hover { background: #00ffcc; color: #1e1e24; }
        .btn-mute { border-color: #ff5555; }
        .btn-mute:hover { background: #ff5555; color: #fff; }
    </style>
</head>
<body>
    <h1>Simulador de Notas de Guitarra</h1>
    <p>Selecciona una nota para inyectar en tu preamplificador:</p>
    <div>
        <button class='btn' onclick='setFreq(82.41)'>E (6ta) - 82Hz</button>
        <button class='btn' onclick='setFreq(110.00)'>A (5ta) - 110Hz</button>
        <button class='btn' onclick='setFreq(146.83)'>D (4ta) - 146Hz</button>
    </div>
    <div>
        <button class='btn' onclick='setFreq(196.00)'>G (3ra) - 196Hz</button>
        <button class='btn' onclick='setFreq(246.94)'>B (2da) - 246Hz</button>
        <button class='btn' onclick='setFreq(329.63)'>E (1ra) - 329Hz</button>
    </div>
    <br>
    <div>
        <button class='btn' onclick='setFreq(440.00)'>La (A4) - 440Hz</button>
        <button class='btn btn-mute' onclick='setFreq(0)'>MUTEAR</button>
    </div>
    <script>
        function setFreq(f) { fetch('/set?f=' + f); }
    </script>
</body>
</html>
)rawliteral";

void setup() {
  Serial.begin(115200);

  // 1. Configuración de Hardware I2S
  i2s_config_t i2s_config = {.mode =
                                 (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
                             .sample_rate = SAMPLE_RATE,
                             .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
                             .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
                             .communication_format = I2S_COMM_FORMAT_STAND_I2S,
                             .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
                             .dma_buf_count = 4,
                             .dma_buf_len = BUFFER_SIZE,
                             .use_apll = false};

  i2s_pin_config_t pin_config = {.bck_io_num = I2S_BCK_IO,
                                 .ws_io_num = I2S_WS_IO,
                                 .data_out_num = I2S_DO_IO,
                                 .data_in_num = I2S_PIN_NO_CHANGE};

  i2s_driver_install(I2S_NUM, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM);

  // 2. Levantar Red Wi-Fi Propia
  WiFi.softAP("Generador_Guitarra_ESP32", "12345678");
  Serial.println("\n--- Red Wi-Fi Iniciada ---");
  Serial.print("Conectate a: Generador_Guitarra_ESP32\nClave: 12345678\nIP del "
               "Servidor: ");
  Serial.println(WiFi.softAPIP());

  // 3. Rutas del Servidor Web
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send_P(200, "text/html", index_html);
  });

  server.on("/set", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("f")) {
      float new_f = request->getParam("f")->value().toFloat();
      portENTER_CRITICAL(&freqMux);
      current_frequency = new_f;
      portEXIT_CRITICAL(&freqMux);
      Serial.printf("Frecuencia cambiada a: %.2f Hz\n", new_f);
    }
    request->send(200, "text/plain", "OK");
  });

  server.begin();

  // 4. Crear Tarea de Audio en el Core 0 (El Wi-Fi corre por defecto en el Core
  // 1)
  xTaskCreatePinnedToCore(audioTask, "AudioTask", 4096, NULL, 5, NULL, 0);
}

void loop() {
  // El lazo principal queda libre. FreeRTOS e AsyncWebServer manejan todo de
  // fondo.
}
