#include "WebConfigServer.h"

#include <ArduinoJson.h>
#include <WiFi.h>

#include "../bluetooth/BluetoothManager.h"
#include "../config/PedalConfig.h"
#include "../diag/PedalDiag.h"
#include "../input/PedalButtons.h"
#include "../network/PedalSocketServer.h"
#include "../wifi/WiFiManager.h"
#include "../diag/DiagJson.h"
#include "../diag/DiagPage.h"
#include "WebPages.h"


void WebConfigServer::begin(PedalConfig &config, WiFiManager &wifi,
                            BluetoothManager &bluetooth,
                            PedalSocketServer &socketServer,
                            PedalButtons &buttons) {
  config_ = &config;
  wifi_ = &wifi;
  bluetooth_ = &bluetooth;
  socketServer_ = &socketServer;
  buttons_ = &buttons;

  setupRoutes();

  server_.begin();
  started_ = true;

  Serial.println("[HTTP] Servidor web iniciado.");
}

void WebConfigServer::update() {
  if (started_) {
    server_.handleClient();
  }
}

void WebConfigServer::setupRoutes() {
  server_.on("/", HTTP_GET, [this]() { handleRoot(); });

  server_.on("/api/status", HTTP_GET, [this]() { handleStatus(); });

  server_.on("/api/config", HTTP_POST, [this]() { handleConfig(); });

  server_.on("/api/config/reset", HTTP_POST, [this]() { handleConfigReset(); });

  server_.on("/api/wifi/scan", HTTP_GET, [this]() { handleWifiScan(); });

  server_.on("/api/wifi/save", HTTP_POST, [this]() { handleWifiSave(); });

  server_.on("/api/wifi/reset", HTTP_POST, [this]() { handleWifiReset(); });

  server_.on("/api/system/restart", HTTP_POST, [this]() { handleRestart(); });

  // Diagnóstico: estado en vivo y registro de eventos.
  server_.on("/diagnostico", HTTP_GET, [this]() { handleDiagPage(); });

  server_.on("/api/diag", HTTP_GET, [this]() { handleDiagData(); });

  server_.on("/api/diag/clear", HTTP_POST, [this]() { handleDiagClear(); });

  // Compatibilidad con el portal cautivo de versiones anteriores.
  server_.on("/generate_204", HTTP_GET, [this]() { handleRoot(); });
  server_.on("/gen_204", HTTP_GET, [this]() { handleRoot(); });
  server_.on("/hotspot-detect.html", HTTP_GET, [this]() { handleRoot(); });
  server_.on("/connecttest.txt", HTTP_GET, [this]() { handleRoot(); });
  server_.on("/ncsi.txt", HTTP_GET, [this]() { handleRoot(); });

  server_.onNotFound([this]() {
    if (wifi_->isApMode()) {
      handleRoot();
    } else {
      server_.send(404, "text/plain", "404 - Not Found");
    }
  });
}

void WebConfigServer::handleRoot() {
  Serial.printf("[HTTP] Petición GET / recibida desde %s\n",
                server_.client().remoteIP().toString().c_str());
  const auto &timing = config_->timing();
  const auto &connections = config_->connections();
  const auto &behavior = config_->behavior();

  server_.send(
      200, "text/html",
      WebPages::dashboard(wifi_->isApMode(), wifi_->isConnected(),
                          connections.bluetoothEnabled,
                          bluetooth_->isConnected(), connections.tcpEnabled,
                          socketServer_->connectedClients(), wifi_->ipAddress(),
                          wifi_->storedSSID(), timing.doublePressWindowMs,
                          timing.holdThresholdMs, timing.wifiResetHoldMs,
                          behavior.mode == PedalMode::SECTIONS,
                          behavior.overlapPercent, behavior.sectionHoldMs));
}

void WebConfigServer::handleStatus() {
  const auto &connections = config_->connections();

  server_.send(200, "application/json",
               WebPages::jsonStatus(
                   wifi_->isApMode(), wifi_->isConnected(),
                   connections.bluetoothEnabled, bluetooth_->isConnected(),
                   connections.tcpEnabled, socketServer_->connectedClients(),
                   wifi_->ipAddress(), wifi_->storedSSID(),
                   config_->behavior().mode == PedalMode::SECTIONS));
}

String WebConfigServer::requestBody() {
  if (server_.hasArg("plain")) {
    return server_.arg("plain");
  }

  return "";
}

String WebConfigServer::readString(const String &body, const char *key) const {
  JsonDocument doc;

  if (deserializeJson(doc, body)) {
    return "";
  }

  return doc[key] | "";
}

bool WebConfigServer::readBool(const String &body, const char *key,
                               bool fallback) const {
  JsonDocument doc;

  if (deserializeJson(doc, body)) {
    return fallback;
  }

  return doc[key] | fallback;
}

unsigned long WebConfigServer::readUInt(const String &body, const char *key,
                                        unsigned long fallback) const {
  JsonDocument doc;

  if (deserializeJson(doc, body)) {
    return fallback;
  }

  return doc[key] | fallback;
}

void WebConfigServer::handleConfig() {
  const String body = requestBody();

  auto &timing = config_->timing();
  auto &connections = config_->connections();
  auto &behavior = config_->behavior();

  if (body.isEmpty()) {
    server_.send(400, "text/plain", "JSON requerido");
    return;
  }

  const PedalMode previousMode = behavior.mode;
  const uint8_t previousOverlap = behavior.overlapPercent;

  timing.doublePressWindowMs =
      readUInt(body, "doublePressWindowMs", timing.doublePressWindowMs);

  timing.holdThresholdMs =
      readUInt(body, "holdThresholdMs", timing.holdThresholdMs);

  timing.wifiResetHoldMs =
      readUInt(body, "wifiResetHoldMs", timing.wifiResetHoldMs);

  connections.bluetoothEnabled =
      readBool(body, "bluetoothEnabled", connections.bluetoothEnabled);

  connections.tcpEnabled = readBool(body, "tcpEnabled", connections.tcpEnabled);

  // Modo del pedal. Un texto desconocido o ausente deja el modo actual.
  const String mode = readString(body, "mode");

  if (mode == "lines") {
    behavior.mode = PedalMode::LINES;
  } else if (mode == "sections") {
    behavior.mode = PedalMode::SECTIONS;
  }

  const unsigned long overlap =
      readUInt(body, "overlapPercent", behavior.overlapPercent);

  behavior.overlapPercent = static_cast<uint8_t>(
      overlap > PedalConfig::MAX_OVERLAP_PERCENT
          ? PedalConfig::MAX_OVERLAP_PERCENT
          : overlap);

  behavior.sectionHoldMs =
      readUInt(body, "sectionHoldMs", behavior.sectionHoldMs);

  config_->clamp();
  config_->save();

  // Si cambió el modo, se cortan los gestos en curso (por ejemplo, un scroll
  // por líneas con el botón apretado) para que no queden trabados.
  if (behavior.mode != previousMode) {
    buttons_->onModeChanged();
  }

  // Avisa a las apps conectadas (modo y contexto) sin reiniciar nada.
  if (behavior.mode != previousMode || behavior.overlapPercent != previousOverlap) {
    socketServer_->applyBehavior();
  }

  bluetooth_->setEnabled(connections.bluetoothEnabled);
  socketServer_->setEnabled(connections.tcpEnabled);

  server_.send(200, "application/json", "{\"ok\":true}");
}

void WebConfigServer::handleConfigReset() {
  const PedalMode previousMode = config_->behavior().mode;

  config_->reset();

  if (config_->behavior().mode != previousMode) {
    buttons_->onModeChanged();
  }

  socketServer_->applyBehavior();

  bluetooth_->setEnabled(config_->connections().bluetoothEnabled);
  socketServer_->setEnabled(config_->connections().tcpEnabled);

  server_.send(200, "application/json", "{\"ok\":true}");
}

void WebConfigServer::handleWifiScan() {
  if (!wifi_->isApMode()) {
    server_.send(403, "application/json",
                 "{\"error\":\"El escaneo está disponible en modo AP.\"}");
    return;
  }

  const int count = WiFi.scanNetworks(false, true);

  String json = "[";

  for (int i = 0; i < count; ++i) {
    const String ssid = WiFi.SSID(i);

    if (ssid.isEmpty()) {
      continue;
    }

    if (json.length() > 1) {
      json += ",";
    }

    String safe = ssid;
    safe.replace("\\", "\\\\");
    safe.replace("\"", "\\\"");

    json += "\"";
    json += safe;
    json += "\"";
  }

  json += "]";

  WiFi.scanDelete();

  server_.send(200, "application/json", json);
}

void WebConfigServer::handleWifiSave() {
  const String body = requestBody();

  const String ssid = readString(body, "ssid");
  const String password = readString(body, "pass");

  if (ssid.isEmpty()) {
    server_.send(400, "text/plain", "SSID vacío");
    return;
  }

  if (!wifi_->saveCredentials(ssid, password)) {
    server_.send(400, "text/plain", "No se pudieron guardar las credenciales");
    return;
  }

  server_.send(200, "text/html", WebPages::savedPage());

  delay(1000);
  ESP.restart();
}

void WebConfigServer::handleWifiReset() {
  server_.send(200, "application/json", "{\"ok\":true}");
  delay(300);
  wifi_->resetCredentialsAndRestart();
}

void WebConfigServer::handleRestart() {
  server_.send(200, "application/json", "{\"ok\":true}");
  delay(300);
  ESP.restart();
}

// ─────────────────────────────────────────────
// Diagnóstico
// ─────────────────────────────────────────────

void WebConfigServer::handleDiagPage() {
  server_.send_P(200, "text/html; charset=utf-8", DiagPage::html());
}

void WebConfigServer::handleDiagData() {
  // Estático: la estructura es grande para el stack del loop.
  static DiagSnapshot snap;

  const unsigned long now = millis();
  const auto &timing = config_->timing();
  const auto &connections = config_->connections();

  snap.uptimeMs = static_cast<uint32_t>(now);
  snap.heapFree = ESP.getFreeHeap();
  snap.heapMin = ESP.getMinFreeHeap();

  snap.wifiConnected = wifi_->isConnected();
  snap.apMode = wifi_->isApMode();
  snap.rssi = snap.wifiConnected && !snap.apMode ? WiFi.RSSI() : 0;

  strncpy(snap.ip, wifi_->ipAddress().c_str(), sizeof(snap.ip) - 1);
  snap.ip[sizeof(snap.ip) - 1] = '\0';

  strncpy(snap.ssid, wifi_->storedSSID().c_str(), sizeof(snap.ssid) - 1);
  snap.ssid[sizeof(snap.ssid) - 1] = '\0';

  snap.bleEnabled = connections.bluetoothEnabled;
  snap.bleConnected = bluetooth_->isConnected();
  snap.tcpEnabled = connections.tcpEnabled;
  snap.tcpRunning = socketServer_->isRunning();
  snap.tcpClients = socketServer_->connectedClients();
  snap.tcpPort = PedalSocketServer::PORT;

  snap.holdMs = timing.holdThresholdMs;
  snap.doubleMs = timing.doublePressWindowMs;
  snap.resetMs = timing.wifiResetHoldMs;

  const auto &behavior = config_->behavior();
  snap.sectionsMode = behavior.mode == PedalMode::SECTIONS;
  snap.overlapPercent = behavior.overlapPercent;
  snap.sectionHoldMs = static_cast<uint32_t>(behavior.sectionHoldMs);

  snap.buttons = buttons_->snapshot(now);
  snap.pinUp = PedalButtons::PIN_UP;
  snap.pinDown = PedalButtons::PIN_DOWN;

  snap.deviceCount = 0;

  for (uint8_t slot = 0; slot < PedalSocketServer::MAX_CLIENTS; ++slot) {
    if (socketServer_->deviceDiag(slot, snap.devices[snap.deviceCount])) {
      ++snap.deviceCount;
    }
  }

  snap.songCount = 0;

  while (snap.songCount < PedalSocketServer::MAX_CLIENTS &&
         socketServer_->songDiag(snap.songCount, snap.songs[snap.songCount])) {
    ++snap.songCount;
  }

  snap.motionActive = socketServer_->motionActive();

  uint32_t since = 0;

  if (server_.hasArg("since")) {
    since = strtoul(server_.arg("since").c_str(), nullptr, 10);
  }

  snap.logSeq = PedalDiag::lastSeq();
  snap.logCount = PedalDiag::copySince(since, snap.log, DiagSnapshot::MAX_LOG);

  String json;
  json.reserve(2048 + snap.logCount * 150);
  DiagJson::build(snap, json);

  server_.sendHeader("Cache-Control", "no-store");
  server_.send(200, "application/json", json);
}

void WebConfigServer::handleDiagClear() {
  PedalDiag::clear();

  String body = "{\"seq\":";
  body += String(static_cast<unsigned long>(PedalDiag::lastSeq()));
  body += "}";

  server_.send(200, "application/json", body);
}