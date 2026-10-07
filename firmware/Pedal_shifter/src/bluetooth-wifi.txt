#include <BleKeyboard.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiServer.h>
#include <WiFiUdp.h>

// ============================================================
// PINES
// ============================================================

const int PIN_SCROLL_UP = 17;   // LOW = presionado
const int PIN_SCROLL_DOWN = 18; // LOW = presionado
const int PIN_STATUS_LED = 16;
const int PIN_MODE_SEL = 4; // LOW = Bluetooth / HIGH = WiFi

// ============================================================
// RED
// ============================================================

const uint16_t SOCKET_PORT = 8080;

const char *AP_SSID = "PedalConfig_wifi";
const char *AP_PASS = "config1234";

const char *MDNS_HOSTNAME = "pedalshifter";
const char *MDNS_SERVICE = "_pedal";

const uint16_t UDP_BCAST_PORT = 4444;
const unsigned long BCAST_INTERVAL_MS = 3000;

// ============================================================
// CONFIGURACION DEL PEDAL
// ============================================================

struct PedalConfig {
  unsigned long doublePressWindowMs;
  unsigned long holdThresholdMs;
  unsigned long wifiResetHoldMs;
};

const unsigned long DEFAULT_DOUBLE_PRESS_WINDOW_MS = 500;
const unsigned long DEFAULT_HOLD_THRESHOLD_MS = 500;
const unsigned long DEFAULT_WIFI_RESET_HOLD_MS = 3000;

const unsigned long MIN_DOUBLE_PRESS_WINDOW_MS = 150;
const unsigned long MAX_DOUBLE_PRESS_WINDOW_MS = 1500;

const unsigned long MIN_HOLD_THRESHOLD_MS = 150;
const unsigned long MAX_HOLD_THRESHOLD_MS = 3000;

const unsigned long MIN_WIFI_RESET_HOLD_MS = 1000;
const unsigned long MAX_WIFI_RESET_HOLD_MS = 10000;

PedalConfig pedalConfig = {DEFAULT_DOUBLE_PRESS_WINDOW_MS,
                           DEFAULT_HOLD_THRESHOLD_MS,
                           DEFAULT_WIFI_RESET_HOLD_MS};

// ============================================================
// OBJETOS GLOBALES
// ============================================================

BleKeyboard bleKeyboard("Pedal Cancionero", "Giovi", 100);

Preferences prefs;

WiFiServer socketServer(SOCKET_PORT);
WebServer httpServer(80);
DNSServer dnsServer;
WiFiUDP udp;

// ============================================================
// ESTADO GENERAL
// ============================================================

bool useSocketMode = false;
bool socketConnected = false;
bool mdnsStarted = false;
bool apMode = false;
bool httpServerStarted = false;

unsigned long lastBcast = 0;

unsigned long lastModeCheck = 0;
const unsigned long MODE_DEBOUNCE_MS = 50;

// ============================================================
// ESTADO DE BOTONES
// ============================================================

enum ButtonState {
  BUTTON_IDLE,
  BUTTON_FIRST_PRESS,
  BUTTON_WAITING_DOUBLE,
  BUTTON_SECOND_PRESS,
  BUTTON_SCROLLING
};

ButtonState upState = BUTTON_IDLE;
ButtonState downState = BUTTON_IDLE;

unsigned long upPressStart = 0;
unsigned long downPressStart = 0;

unsigned long upFirstRelease = 0;
unsigned long downFirstRelease = 0;

// ============================================================
// RESET WIFI CON AMBOS BOTONES
// ============================================================

bool bothButtonsActive = false;
unsigned long bothButtonsStart = 0;

unsigned long lastWifiResetLed = 0;
bool wifiResetLedState = LOW;

// ============================================================
// DEBOUNCE
// ============================================================

unsigned long lastDebounceTimeUp = 0;
unsigned long lastDebounceTimeDown = 0;

bool lastRawUp = HIGH;
bool lastRawDown = HIGH;

bool debouncedUp = HIGH;
bool debouncedDown = HIGH;

const unsigned long DEBOUNCE_DELAY = 50;

// ============================================================
// LED
// ============================================================

unsigned long lastLedBlink = 0;
bool ledState = LOW;

// ============================================================
// CLIENTES TCP
// ============================================================

const uint8_t MAX_CLIENTS = 7;
WiFiClient clients[MAX_CLIENTS];

// ============================================================
// PAGINA WIFI
// ============================================================

const char *CONFIG_PAGE = R"rawliteral(
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedal Cancionero</title>

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
      margin-bottom: 10px;
    }

    .card {
      background: #1d1d1d;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-top: 15px;
      margin-bottom: 5px;
    }

    input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #444;
      background: #292929;
      color: #fff;
      font-size: 16px;
    }

    button {
      margin-top: 15px;
      padding: 12px 18px;
      border: none;
      border-radius: 8px;
      background: #3b82f6;
      color: white;
      font-size: 16px;
      cursor: pointer;
    }

    button.secondary {
      background: #444;
    }

    .network {
      padding: 10px;
      margin-top: 8px;
      border-radius: 8px;
      background: #292929;
      cursor: pointer;
    }

    .network:hover {
      background: #383838;
    }

    .info {
      color: #aaa;
      font-size: 14px;
      line-height: 1.5;
    }

    a {
      color: #60a5fa;
    }

    #networks {
      margin-top: 15px;
    }

    .error {
      color: #f87171;
    }

    .success {
      color: #4ade80;
    }
  </style>
</head>

<body>

<div class="container">

  <div class="card">
    <h1>Pedal Cancionero</h1>

    <p class="info">
      Configuración de conexión WiFi.
    </p>

    <form method="POST" action="/save">

      <label for="ssid">Red WiFi</label>
      <input
        type="text"
        id="ssid"
        name="ssid"
        placeholder="Nombre de la red"
        required
      >

      <label for="pass">Contraseña</label>
      <input
        type="password"
        id="pass"
        name="pass"
        placeholder="Contraseña"
      >

      <button type="submit">
        Guardar y conectar
      </button>

    </form>

    <button
      type="button"
      class="secondary"
      onclick="scanNetworks()">
      Buscar redes
    </button>

    <div id="networks"></div>

  </div>

  <div class="card">

    <h2>Configuración del pedal</h2>

    <p class="info">
      Podés configurar el comportamiento de los botones.
    </p>

    <a href="/config">
      Abrir configuración avanzada
    </a>

  </div>

</div>

<script>

async function scanNetworks() {

  const container = document.getElementById("networks");

  container.innerHTML = "Buscando redes...";

  try {

    const response = await fetch("/scan");

    if (!response.ok) {
      throw new Error("Error al escanear");
    }

    const networks = await response.json();

    container.innerHTML = "";

    if (networks.length === 0) {
      container.innerHTML = "<p class='info'>No se encontraron redes.</p>";
      return;
    }

    networks.forEach(function(ssid) {

      const item = document.createElement("div");

      item.className = "network";
      item.textContent = ssid;

      item.onclick = function() {
        document.getElementById("ssid").value = ssid;
      };

      container.appendChild(item);

    });

  } catch (error) {

    container.innerHTML =
      "<p class='error'>No se pudieron buscar las redes.</p>";

    console.error(error);
  }

}

</script>

</body>
</html>
)rawliteral";

// ============================================================
// PAGINA GUARDADO WIFI
// ============================================================

const char *SAVED_PAGE = R"rawliteral(
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedal Cancionero</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      background: #111;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }

    .card {
      background: #1d1d1d;
      padding: 30px;
      border-radius: 12px;
      max-width: 450px;
    }
  </style>
</head>

<body>

<div class="card">

  <h1>Configuración guardada</h1>

  <p>
    El pedal se reiniciará e intentará conectarse a la red WiFi.
  </p>

</div>

</body>
</html>
)rawliteral";

// ============================================================
// PREFERENCIAS WIFI
// ============================================================

String getStoredSSID() {

  prefs.begin("wifi", true);

  String ssid = prefs.getString("ssid", "");

  prefs.end();

  return ssid;
}

String getStoredPass() {

  prefs.begin("wifi", true);

  String pass = prefs.getString("pass", "");

  prefs.end();

  return pass;
}

void storeCredentials(const String &ssid, const String &pass) {

  prefs.begin("wifi", false);

  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);

  prefs.end();
}

void clearCredentials() {

  prefs.begin("wifi", false);

  prefs.clear();

  prefs.end();

  Serial.println("[WiFi] Credenciales eliminadas");
}

// ============================================================
// CONFIGURACION DEL PEDAL
// ============================================================

void clampPedalConfig() {

  pedalConfig.doublePressWindowMs =
      constrain(pedalConfig.doublePressWindowMs, MIN_DOUBLE_PRESS_WINDOW_MS,
                MAX_DOUBLE_PRESS_WINDOW_MS);

  pedalConfig.holdThresholdMs =
      constrain(pedalConfig.holdThresholdMs, MIN_HOLD_THRESHOLD_MS,
                MAX_HOLD_THRESHOLD_MS);

  pedalConfig.wifiResetHoldMs =
      constrain(pedalConfig.wifiResetHoldMs, MIN_WIFI_RESET_HOLD_MS,
                MAX_WIFI_RESET_HOLD_MS);
}

void loadPedalConfig() {

  prefs.begin("pedal", true);

  pedalConfig.doublePressWindowMs =
      prefs.getUInt("doubleWindow", DEFAULT_DOUBLE_PRESS_WINDOW_MS);

  pedalConfig.holdThresholdMs =
      prefs.getUInt("holdThreshold", DEFAULT_HOLD_THRESHOLD_MS);

  pedalConfig.wifiResetHoldMs =
      prefs.getUInt("wifiResetHold", DEFAULT_WIFI_RESET_HOLD_MS);

  prefs.end();

  clampPedalConfig();
}

void savePedalConfig() {

  clampPedalConfig();

  prefs.begin("pedal", false);

  prefs.putUInt("doubleWindow", pedalConfig.doublePressWindowMs);

  prefs.putUInt("holdThreshold", pedalConfig.holdThresholdMs);

  prefs.putUInt("wifiResetHold", pedalConfig.wifiResetHoldMs);

  prefs.end();
}

void resetPedalConfig() {

  pedalConfig.doublePressWindowMs = DEFAULT_DOUBLE_PRESS_WINDOW_MS;

  pedalConfig.holdThresholdMs = DEFAULT_HOLD_THRESHOLD_MS;

  pedalConfig.wifiResetHoldMs = DEFAULT_WIFI_RESET_HOLD_MS;

  savePedalConfig();
}

// ============================================================
// UTILIDADES HTTP
// ============================================================

bool parseUnsignedArg(const String &value, unsigned long &result) {

  if (value.length() == 0)
    return false;

  for (size_t i = 0; i < value.length(); i++) {

    if (!isDigit(value[i]))
      return false;
  }

  result = value.toInt();

  return true;
}

// ============================================================
// PAGINA DE CONFIGURACION DEL PEDAL
// ============================================================

String buildPedalConfigPage() {

  String page;

  page.reserve(7000);

  page += R"rawliteral(
<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>Configuración del pedal</title>

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

.card {
  background: #1d1d1d;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

h1 {
  margin-top: 0;
}

label {
  display: block;
  margin-top: 16px;
  margin-bottom: 6px;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #444;
  background: #292929;
  color: white;
  font-size: 16px;
}

button {
  margin-top: 18px;
  padding: 12px 18px;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  font-size: 16px;
  cursor: pointer;
}

button.reset {
  background: #444;
}

.info {
  color: #aaa;
  line-height: 1.5;
}

.value {
  color: #60a5fa;
}

a {
  color: #60a5fa;
}

.warning {
  color: #fbbf24;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>Configuración del pedal</h1>

<p class="info">
Configurá los tiempos utilizados por el pedal.
Los valores están expresados en milisegundos.
</p>

<form method="POST" action="/config/save">

<label for="doubleWindow">
Ventana para segundo toque
</label>

<input
  type="number"
  id="doubleWindow"
  name="doubleWindow"
  min=")rawliteral";

  page += String(MIN_DOUBLE_PRESS_WINDOW_MS);

  page += R"rawliteral("
  max=")rawliteral";

  page += String(MAX_DOUBLE_PRESS_WINDOW_MS);

  page += R"rawliteral("
  value=")rawliteral";

  page += String(pedalConfig.doublePressWindowMs);

  page += R"rawliteral("
  required
>

<label for="holdThreshold">
Tiempo para comenzar scroll
</label>

<input
  type="number"
  id="holdThreshold"
  name="holdThreshold"
  min=")rawliteral";

  page += String(MIN_HOLD_THRESHOLD_MS);

  page += R"rawliteral("
  max=")rawliteral";

  page += String(MAX_HOLD_THRESHOLD_MS);

  page += R"rawliteral("
  value=")rawliteral";

  page += String(pedalConfig.holdThresholdMs);

  page += R"rawliteral("
  required
>

<label for="wifiResetHold">
Tiempo para reset WiFi
</label>

<input
  type="number"
  id="wifiResetHold"
  name="wifiResetHold"
  min=")rawliteral";

  page += String(MIN_WIFI_RESET_HOLD_MS);

  page += R"rawliteral("
  max=")rawliteral";

  page += String(MAX_WIFI_RESET_HOLD_MS);

  page += R"rawliteral("
  value=")rawliteral";

  page += String(pedalConfig.wifiResetHoldMs);

  page += R"rawliteral("
  required
>

<button type="submit">
Guardar configuración
</button>

</form>

<form method="POST" action="/config/reset">

<button
  type="submit"
  class="reset">

Restaurar valores por defecto

</button>

</form>

</div>

<div class="card">

<h2>Estado de red</h2>

<p class="info">

IP:
<span class="value">
)rawliteral";

  if (apMode) {
    page += WiFi.softAPIP().toString();
  } else {
    page += WiFi.localIP().toString();
  }

  page += R"rawliteral(
</span>

</p>

<p class="info">
TCP:
<span class="value">8080</span>
</p>

<p class="info">
UDP:
<span class="value">4444</span>
</p>

<p class="info">
mDNS:
<span class="value">pedalshifter.local</span>
</p>

</div>

<div class="card">

<p class="info">
Los cambios de configuración del pedal se aplican inmediatamente.
</p>

<p class="info">
Para volver a configurar la red WiFi también podés mantener
presionados ambos botones durante el tiempo configurado.
</p>

<a href="/">
Volver a configuración WiFi
</a>

</div>

</div>

</body>
</html>
)rawliteral";

  return page;
}

// ============================================================
// WIFI SCAN
// ============================================================

void handleScan() {

  if (!apMode) {

    httpServer.send(403, "text/plain",
                    "El escaneo solo esta disponible en modo AP.");

    return;
  }

  Serial.println("[WiFi] Escaneando redes...");

  int n = WiFi.scanNetworks(false, true);

  String json = "[";

  for (int i = 0; i < n; i++) {

    String ssid = WiFi.SSID(i);

    if (ssid.length() == 0)
      continue;

    ssid.replace("\\", "\\\\");
    ssid.replace("\"", "\\\"");

    if (json.length() > 1)
      json += ",";

    json += "\"";
    json += ssid;
    json += "\"";
  }

  json += "]";

  WiFi.scanDelete();

  httpServer.send(200, "application/json", json);

  Serial.println("[WiFi] Scan terminado");
}

// ============================================================
// GUARDAR WIFI
// ============================================================

void handleSaveWifi() {

  if (!httpServer.hasArg("ssid") || !httpServer.hasArg("pass")) {

    httpServer.send(400, "text/plain", "Faltan parametros");

    return;
  }

  String ssid = httpServer.arg("ssid");
  String pass = httpServer.arg("pass");

  ssid.trim();

  if (ssid.length() == 0) {

    httpServer.send(400, "text/plain", "SSID vacio");

    return;
  }

  storeCredentials(ssid, pass);

  httpServer.send(200, "text/html", SAVED_PAGE);

  delay(2000);

  ESP.restart();
}

// ============================================================
// CONFIG PEDAL - GUARDAR
// ============================================================

void handleSavePedalConfig() {

  if (!httpServer.hasArg("doubleWindow") ||
      !httpServer.hasArg("holdThreshold") ||
      !httpServer.hasArg("wifiResetHold")) {

    httpServer.send(400, "text/plain", "Faltan parametros de configuracion");

    return;
  }

  unsigned long doubleWindow;
  unsigned long holdThreshold;
  unsigned long wifiResetHold;

  if (!parseUnsignedArg(httpServer.arg("doubleWindow"), doubleWindow) ||

      !parseUnsignedArg(httpServer.arg("holdThreshold"), holdThreshold) ||

      !parseUnsignedArg(httpServer.arg("wifiResetHold"), wifiResetHold)) {

    httpServer.send(400, "text/plain", "Parametros invalidos");

    return;
  }

  pedalConfig.doublePressWindowMs = doubleWindow;

  pedalConfig.holdThresholdMs = holdThreshold;

  pedalConfig.wifiResetHoldMs = wifiResetHold;

  clampPedalConfig();

  savePedalConfig();

  httpServer.sendHeader("Location", "/config", true);

  httpServer.send(303, "text/plain", "Configuracion guardada");
}

// ============================================================
// CONFIG PEDAL - RESET
// ============================================================

void handleResetPedalConfig() {

  resetPedalConfig();

  httpServer.sendHeader("Location", "/config", true);

  httpServer.send(303, "text/plain", "Configuracion restaurada");
}

// ============================================================
// CAPTIVE PORTAL
// ============================================================

void handleCaptivePortal() { httpServer.send(200, "text/html", CONFIG_PAGE); }

// ============================================================
// ROOT
// ============================================================

void handleRoot() {

  if (apMode) {

    httpServer.send(200, "text/html", CONFIG_PAGE);

    return;
  }

  httpServer.send(200, "text/plain", "Pedal Cancionero activo");
}

// ============================================================
// HTTP ROUTES
// ============================================================

void setupHttpRoutes() {

  httpServer.on("/", HTTP_GET, handleRoot);

  httpServer.on("/config", HTTP_GET, []() {
    httpServer.send(200, "text/html", buildPedalConfigPage());
  });

  httpServer.on("/scan", HTTP_GET, handleScan);

  httpServer.on("/save", HTTP_POST, handleSaveWifi);

  httpServer.on("/config/save", HTTP_POST, handleSavePedalConfig);

  httpServer.on("/config/reset", HTTP_POST, handleResetPedalConfig);

  // Android
  httpServer.on("/generate_204", HTTP_GET,
                []() { httpServer.send(200, "text/html", CONFIG_PAGE); });

  // Android
  httpServer.on("/gen_204", HTTP_GET,
                []() { httpServer.send(200, "text/html", CONFIG_PAGE); });

  // Apple
  httpServer.on("/hotspot-detect.html", HTTP_GET,
                []() { httpServer.send(200, "text/html", CONFIG_PAGE); });

  // Windows
  httpServer.on("/connecttest.txt", HTTP_GET,
                []() { httpServer.send(200, "text/html", CONFIG_PAGE); });

  // Windows
  httpServer.on("/ncsi.txt", HTTP_GET,
                []() { httpServer.send(200, "text/html", CONFIG_PAGE); });

  httpServer.on("/library/test/success.html", HTTP_GET,
                []() { httpServer.send(200, "text/html", CONFIG_PAGE); });

  httpServer.onNotFound([]() {
    if (apMode) {

      handleCaptivePortal();

      return;
    }

    httpServer.send(404, "text/plain", "404 - Not Found");
  });
}

// ============================================================
// HTTP SERVER
// ============================================================

void startHttpServer() {

  if (httpServerStarted)
    return;

  setupHttpRoutes();

  httpServer.begin();

  httpServerStarted = true;

  Serial.println("[HTTP] HTTP server iniciado.");
}

// ============================================================
// WIFI AP
// ============================================================

void startAP() {

  apMode = true;

  socketConnected = false;

  WiFi.mode(WIFI_AP);

  bool result = WiFi.softAP(AP_SSID, AP_PASS);

  if (!result) {

    Serial.println("[WiFi] Error iniciando AP");

    return;
  }

  IPAddress ip = WiFi.softAPIP();

  Serial.println();
  Serial.println("================================");

  Serial.println("MODO CONFIGURACION WIFI");

  Serial.print("SSID: ");

  Serial.println(AP_SSID);

  Serial.print("IP: ");

  Serial.println(ip);

  Serial.println("================================");

  dnsServer.start(53, "*", ip);

  startHttpServer();
}

// ============================================================
// WIFI STA
// ============================================================

void startWiFi() {

  String ssid = getStoredSSID();
  String pass = getStoredPass();

  if (ssid.length() == 0) {

    Serial.println("[WiFi] No hay credenciales.");

    startAP();

    return;
  }

  Serial.println();
  Serial.println("[WiFi] Intentando conectar...");

  Serial.print("SSID: ");

  Serial.println(ssid);

  WiFi.mode(WIFI_STA);

  WiFi.begin(ssid.c_str(), pass.c_str());

  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 15000) {

    delay(250);

    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("[WiFi] No se pudo conectar.");

    WiFi.disconnect(true);

    delay(500);

    startAP();

    return;
  }

  apMode = false;

  Serial.println("[WiFi] Conectado.");

  Serial.print("[WiFi] IP: ");

  Serial.println(WiFi.localIP());

  if (MDNS.begin(MDNS_HOSTNAME)) {

    mdnsStarted = true;

    MDNS.addService(MDNS_SERVICE, "tcp", SOCKET_PORT);

    Serial.println("[mDNS] pedalshifter.local");
  }

  socketServer.begin();

  socketConnected = true;

  startHttpServer();

  udp.begin(UDP_BCAST_PORT);

  Serial.println("[WiFi] TCP server iniciado.");
}

// ============================================================
// UDP DISCOVERY
// ============================================================

void broadcastUDP() {

  IPAddress ip = WiFi.localIP();

  char buf[64];

  snprintf(buf, sizeof(buf), "{\"ip\":\"%s\",\"port\":%d}",
           ip.toString().c_str(), SOCKET_PORT);

  udp.beginPacket("255.255.255.255", UDP_BCAST_PORT);

  udp.write((uint8_t *)buf, strlen(buf));

  udp.endPacket();
}

// ============================================================
// CLIENTES TCP
// ============================================================

void acceptClients() {

  if (!socketConnected)
    return;

  WiFiClient newClient = socketServer.available();

  if (!newClient)
    return;

  for (uint8_t i = 0; i < MAX_CLIENTS; i++) {

    if (!clients[i] || !clients[i].connected()) {

      if (clients[i])
        clients[i].stop();

      clients[i] = newClient;

      Serial.print("[TCP] Cliente conectado slot ");

      Serial.println(i);

      return;
    }
  }

  Serial.println("[TCP] No hay slots disponibles.");

  newClient.stop();
}

// ============================================================
// LIMPIAR CLIENTES
// ============================================================

void cleanClients() {

  for (uint8_t i = 0; i < MAX_CLIENTS; i++) {

    if (clients[i] && !clients[i].connected()) {

      clients[i].stop();

      Serial.print("[TCP] Cliente desconectado slot ");

      Serial.println(i);
    }
  }
}

// ============================================================
// BROADCAST TCP
// ============================================================

void broadcastEvent(const char *msg) {

  for (uint8_t i = 0; i < MAX_CLIENTS; i++) {

    if (clients[i] && clients[i].connected()) {

      clients[i].print(msg);
    }
  }
}

// ============================================================
// ENVIO DE EVENTOS
// ============================================================

void sendPedalEvent(const char *socketEvent, char bluetoothKey) {

  if (useSocketMode && socketConnected) {

    broadcastEvent(socketEvent);

    return;
  }

  if (bleKeyboard.isConnected()) {

    bleKeyboard.write(bluetoothKey);
  }
}

void sendPedalPress(const char *socketEvent, char bluetoothKey) {

  if (useSocketMode && socketConnected) {

    broadcastEvent(socketEvent);

    return;
  }

  if (bleKeyboard.isConnected()) {

    bleKeyboard.press(bluetoothKey);
  }
}

void sendPedalRelease(const char *socketEvent, char bluetoothKey) {

  if (useSocketMode && socketConnected) {

    broadcastEvent(socketEvent);

    return;
  }

  if (bleKeyboard.isConnected()) {

    bleKeyboard.release(bluetoothKey);
  }
}

// ============================================================
// EVENTOS HOME / END
// ============================================================

void sendHome() {

  Serial.println("[Evento] HOME");

  sendPedalEvent("HOME\n", 'h');
}

void sendEnd() {

  Serial.println("[Evento] END");

  sendPedalEvent("END\n", 'e');
}

// ============================================================
// CANCELAR EVENTOS POR RESET WIFI
// ============================================================

void cancelButtonEventsForWifiReset() {

  if (upState == BUTTON_SCROLLING) {

    sendPedalRelease("UP_RELEASE\n", '1');
  }

  if (downState == BUTTON_SCROLLING) {

    sendPedalRelease("DOWN_RELEASE\n", '2');
  }

  upState = BUTTON_IDLE;
  downState = BUTTON_IDLE;

  upPressStart = 0;
  downPressStart = 0;

  upFirstRelease = 0;
  downFirstRelease = 0;
}

// ============================================================
// LED RESET WIFI
// ============================================================

void updateWifiResetLed(unsigned long now) {

  if (!bothButtonsActive) {

    return;
  }

  if (now - lastWifiResetLed >= 150) {

    lastWifiResetLed = now;

    wifiResetLedState = !wifiResetLedState;

    digitalWrite(PIN_STATUS_LED, wifiResetLedState);
  }
}

// ============================================================
// RESET WIFI
// ============================================================

void performWifiReset() {

  Serial.println();
  Serial.println("================================");

  Serial.println("[WiFi] RESET DE CREDENCIALES");

  Serial.println("================================");

  cancelButtonEventsForWifiReset();

  digitalWrite(PIN_STATUS_LED, HIGH);

  clearCredentials();

  delay(500);

  ESP.restart();
}

// ============================================================
// DETECCION RESET WIFI
// ============================================================

bool checkWifiReset(bool upPressed, bool downPressed, unsigned long now) {

  if (upPressed && downPressed) {

    if (!bothButtonsActive) {

      bothButtonsActive = true;

      bothButtonsStart = now;

      lastWifiResetLed = now;

      wifiResetLedState = HIGH;

      digitalWrite(PIN_STATUS_LED, HIGH);

      Serial.println("[WiFi] Ambos botones presionados.");
    }

    updateWifiResetLed(now);

    if (now - bothButtonsStart >= pedalConfig.wifiResetHoldMs) {

      performWifiReset();

      return true;
    }

    return true;
  }

  if (bothButtonsActive) {

    bothButtonsActive = false;

    digitalWrite(PIN_STATUS_LED, LOW);

    wifiResetLedState = LOW;

    Serial.println("[WiFi] Reset cancelado.");
  }

  return false;
}

// ============================================================
// LOGICA BOTON UP
// ============================================================

void updateUpButton(bool pressed, unsigned long now) {

  switch (upState) {

  case BUTTON_IDLE: {

    if (pressed) {

      upState = BUTTON_FIRST_PRESS;

      upPressStart = now;

      Serial.println("[BTN UP] Primer press");
    }

    break;
  }

  case BUTTON_FIRST_PRESS: {

    if (!pressed) {

      unsigned long duration = now - upPressStart;

      if (duration >= pedalConfig.holdThresholdMs) {

        // Seguridad: si por alguna razon
        // no entro antes en scrolling.
        sendPedalRelease("UP_RELEASE\n", '1');

        upState = BUTTON_IDLE;

      } else {

        upFirstRelease = now;

        upState = BUTTON_WAITING_DOUBLE;

        Serial.println("[BTN UP] Primer toque corto");
      }

      break;
    }

    if (now - upPressStart >= pedalConfig.holdThresholdMs) {

      Serial.println("[BTN UP] HOLD -> SCROLL");

      sendPedalPress("UP_PRESS\n", '1');

      upState = BUTTON_SCROLLING;
    }

    break;
  }

  case BUTTON_WAITING_DOUBLE: {

    if (pressed) {

      unsigned long elapsed = now - upFirstRelease;

      if (elapsed <= pedalConfig.doublePressWindowMs) {

        upPressStart = now;

        upState = BUTTON_SECOND_PRESS;

        Serial.println("[BTN UP] Segundo press");
      }
    }

    else {

      if (now - upFirstRelease > pedalConfig.doublePressWindowMs) {

        upState = BUTTON_IDLE;

        upFirstRelease = 0;

        Serial.println("[BTN UP] Ventana doble expirada");
      }
    }

    break;
  }

  case BUTTON_SECOND_PRESS: {

    if (!pressed) {

      unsigned long duration = now - upPressStart;

      if (duration >= pedalConfig.holdThresholdMs) {

        // En condiciones normales,
        // si fue hold ya deberia estar en
        // BUTTON_SCROLLING.
        upState = BUTTON_IDLE;

      } else {

        Serial.println("[BTN UP] DOBLE TOQUE -> HOME");

        sendHome();

        upState = BUTTON_IDLE;
      }

      upPressStart = 0;
      upFirstRelease = 0;

      break;
    }

    if (now - upPressStart >= pedalConfig.holdThresholdMs) {

      Serial.println("[BTN UP] Segundo press HOLD -> SCROLL");

      sendPedalPress("UP_PRESS\n", '1');

      upState = BUTTON_SCROLLING;
    }

    break;
  }

  case BUTTON_SCROLLING: {

    if (!pressed) {

      Serial.println("[BTN UP] RELEASE");

      sendPedalRelease("UP_RELEASE\n", '1');

      upState = BUTTON_IDLE;

      upPressStart = 0;
      upFirstRelease = 0;
    }

    break;
  }
  }
}

// ============================================================
// LOGICA BOTON DOWN
// ============================================================

void updateDownButton(bool pressed, unsigned long now) {

  switch (downState) {

  case BUTTON_IDLE: {

    if (pressed) {

      downState = BUTTON_FIRST_PRESS;

      downPressStart = now;

      Serial.println("[BTN DOWN] Primer press");
    }

    break;
  }

  case BUTTON_FIRST_PRESS: {

    if (!pressed) {

      unsigned long duration = now - downPressStart;

      if (duration >= pedalConfig.holdThresholdMs) {

        sendPedalRelease("DOWN_RELEASE\n", '2');

        downState = BUTTON_IDLE;

      } else {

        downFirstRelease = now;

        downState = BUTTON_WAITING_DOUBLE;

        Serial.println("[BTN DOWN] Primer toque corto");
      }

      break;
    }

    if (now - downPressStart >= pedalConfig.holdThresholdMs) {

      Serial.println("[BTN DOWN] HOLD -> SCROLL");

      sendPedalPress("DOWN_PRESS\n", '2');

      downState = BUTTON_SCROLLING;
    }

    break;
  }

  case BUTTON_WAITING_DOUBLE: {

    if (pressed) {

      unsigned long elapsed = now - downFirstRelease;

      if (elapsed <= pedalConfig.doublePressWindowMs) {

        downPressStart = now;

        downState = BUTTON_SECOND_PRESS;

        Serial.println("[BTN DOWN] Segundo press");
      }
    }

    else {

      if (now - downFirstRelease > pedalConfig.doublePressWindowMs) {

        downState = BUTTON_IDLE;

        downFirstRelease = 0;

        Serial.println("[BTN DOWN] Ventana doble expirada");
      }
    }

    break;
  }

  case BUTTON_SECOND_PRESS: {

    if (!pressed) {

      unsigned long duration = now - downPressStart;

      if (duration >= pedalConfig.holdThresholdMs) {

        downState = BUTTON_IDLE;

      } else {

        Serial.println("[BTN DOWN] DOBLE TOQUE -> END");

        sendEnd();

        downState = BUTTON_IDLE;
      }

      downPressStart = 0;
      downFirstRelease = 0;

      break;
    }

    if (now - downPressStart >= pedalConfig.holdThresholdMs) {

      Serial.println("[BTN DOWN] Segundo press HOLD -> SCROLL");

      sendPedalPress("DOWN_PRESS\n", '2');

      downState = BUTTON_SCROLLING;
    }

    break;
  }

  case BUTTON_SCROLLING: {

    if (!pressed) {

      Serial.println("[BTN DOWN] RELEASE");

      sendPedalRelease("DOWN_RELEASE\n", '2');

      downState = BUTTON_IDLE;

      downPressStart = 0;
      downFirstRelease = 0;
    }

    break;
  }
  }
}

// ============================================================
// LECTURA + DEBOUNCE
// ============================================================

void updateButtons() {

  unsigned long now = millis();

  bool rawUp = digitalRead(PIN_SCROLL_UP);

  bool rawDown = digitalRead(PIN_SCROLL_DOWN);

  // ----------------------------------------------------------
  // Debounce UP
  // ----------------------------------------------------------

  if (rawUp != lastRawUp) {

    lastDebounceTimeUp = now;

    lastRawUp = rawUp;
  }

  if (now - lastDebounceTimeUp >= DEBOUNCE_DELAY) {

    debouncedUp = rawUp;
  }

  // ----------------------------------------------------------
  // Debounce DOWN
  // ----------------------------------------------------------

  if (rawDown != lastRawDown) {

    lastDebounceTimeDown = now;

    lastRawDown = rawDown;
  }

  if (now - lastDebounceTimeDown >= DEBOUNCE_DELAY) {

    debouncedDown = rawDown;
  }

  bool upPressed = debouncedUp == LOW;

  bool downPressed = debouncedDown == LOW;

  // ----------------------------------------------------------
  // RESET WIFI TIENE PRIORIDAD
  // ----------------------------------------------------------

  if (checkWifiReset(upPressed, downPressed, now)) {

    return;
  }

  // ----------------------------------------------------------
  // BOTONES NORMALES
  // ----------------------------------------------------------

  updateUpButton(upPressed, now);

  updateDownButton(downPressed, now);
}

// ============================================================
// MODO BLUETOOTH
// ============================================================

void startBluetooth() {

  Serial.println();
  Serial.println("[Bluetooth] Iniciando BLE...");

  bleKeyboard.begin();

  Serial.println("[Bluetooth] Pedal Cancionero listo.");
}

// ============================================================
// CAMBIO DE MODO
// ============================================================

void checkMode() {

  unsigned long now = millis();

  if (now - lastModeCheck < MODE_DEBOUNCE_MS) {

    return;
  }

  lastModeCheck = now;

  bool newSocketMode = digitalRead(PIN_MODE_SEL) == HIGH;

  if (newSocketMode == useSocketMode) {

    return;
  }

  useSocketMode = newSocketMode;

  Serial.println();

  if (useSocketMode) {

    Serial.println("[MODE] WiFi / Socket");

    if (WiFi.status() == WL_CONNECTED) {

      socketConnected = true;
    }

  } else {

    Serial.println("[MODE] Bluetooth");

    socketConnected = false;
  }
}

// ============================================================
// LED NORMAL
// ============================================================

void updateStatusLed() {

  if (bothButtonsActive)
    return;

  if (useSocketMode) {

    if (WiFi.status() == WL_CONNECTED) {

      digitalWrite(PIN_STATUS_LED, HIGH);

    } else {

      unsigned long now = millis();

      if (now - lastLedBlink >= 500) {

        lastLedBlink = now;

        ledState = !ledState;

        digitalWrite(PIN_STATUS_LED, ledState);
      }
    }

    return;
  }

  // Bluetooth

  if (bleKeyboard.isConnected()) {

    digitalWrite(PIN_STATUS_LED, HIGH);

  } else {

    unsigned long now = millis();

    if (now - lastLedBlink >= 500) {

      lastLedBlink = now;

      ledState = !ledState;

      digitalWrite(PIN_STATUS_LED, ledState);
    }
  }
}

// ============================================================
// SETUP
// ============================================================

void setup() {

  Serial.begin(115200);

  delay(500);

  Serial.println();
  Serial.println("================================");
  Serial.println("   PEDAL CANCIONERO");
  Serial.println("================================");

  // ----------------------------------------------------------
  // Pines
  // ----------------------------------------------------------

  pinMode(PIN_SCROLL_UP, INPUT_PULLUP);

  pinMode(PIN_SCROLL_DOWN, INPUT_PULLUP);

  pinMode(PIN_STATUS_LED, OUTPUT);

  pinMode(PIN_MODE_SEL, INPUT_PULLUP);

  digitalWrite(PIN_STATUS_LED, LOW);

  // ----------------------------------------------------------
  // Configuracion pedal
  // ----------------------------------------------------------

  loadPedalConfig();

  Serial.println("[Config] Configuracion del pedal:");

  Serial.print("  Double window: ");

  Serial.print(pedalConfig.doublePressWindowMs);

  Serial.println(" ms");

  Serial.print("  Hold threshold: ");

  Serial.print(pedalConfig.holdThresholdMs);

  Serial.println(" ms");

  Serial.print("  WiFi reset hold: ");

  Serial.print(pedalConfig.wifiResetHoldMs);

  Serial.println(" ms");

  // ----------------------------------------------------------
  // Modo
  // ----------------------------------------------------------

  useSocketMode = digitalRead(PIN_MODE_SEL) == HIGH;

  Serial.print("[MODE] ");

  if (useSocketMode) {

    Serial.println("WiFi / Socket");

  } else {

    Serial.println("Bluetooth");
  }

  // ----------------------------------------------------------
  // Conexion
  // ----------------------------------------------------------

  if (useSocketMode) {

    startWiFi();

  } else {

    startBluetooth();
  }

  Serial.println();
  Serial.println("[SETUP] Sistema listo.");
}

// ============================================================
// LOOP
// ============================================================

void loop() {

  unsigned long now = millis();

  // ----------------------------------------------------------
  // HTTP / DNS
  // ----------------------------------------------------------

  if (apMode) {

    dnsServer.processNextRequest();
  }

  if (httpServerStarted) {

    httpServer.handleClient();
  }

  // ----------------------------------------------------------
  // TCP
  // ----------------------------------------------------------

  if (useSocketMode && socketConnected) {

    acceptClients();

    cleanClients();

    if (now - lastBcast >= BCAST_INTERVAL_MS) {

      lastBcast = now;

      broadcastUDP();
    }
  }

  // ----------------------------------------------------------
  // Modo
  // ----------------------------------------------------------

  checkMode();

  // ----------------------------------------------------------
  // Botones
  // ----------------------------------------------------------

  updateButtons();

  // ----------------------------------------------------------
  // LED
  // ----------------------------------------------------------

  updateStatusLed();

  // ----------------------------------------------------------
  // BLE
  // ----------------------------------------------------------

  // BleKeyboard gestiona internamente
  // su conexión. No requiere polling adicional.
}