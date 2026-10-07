#include "WebConfigServer.h"

#include <ArduinoJson.h>
#include <WiFi.h>

#include "../config/PedalConfig.h"
#include "../wifi/WiFiManager.h"
#include "../bluetooth/BluetoothManager.h"
#include "../network/PedalSocketServer.h"
#include "WebPages.h"

void WebConfigServer::begin(
    PedalConfig& config,
    WiFiManager& wifi,
    BluetoothManager& bluetooth,
    PedalSocketServer& socketServer
) {
    config_ = &config;
    wifi_ = &wifi;
    bluetooth_ = &bluetooth;
    socketServer_ = &socketServer;

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
    server_.on("/", HTTP_GET, [this]() {
        handleRoot();
    });

    server_.on("/api/status", HTTP_GET, [this]() {
        handleStatus();
    });

    server_.on("/api/config", HTTP_POST, [this]() {
        handleConfig();
    });

    server_.on("/api/config/reset", HTTP_POST, [this]() {
        handleConfigReset();
    });

    server_.on("/api/wifi/scan", HTTP_GET, [this]() {
        handleWifiScan();
    });

    server_.on("/api/wifi/save", HTTP_POST, [this]() {
        handleWifiSave();
    });

    server_.on("/api/wifi/reset", HTTP_POST, [this]() {
        handleWifiReset();
    });

    server_.on("/api/system/restart", HTTP_POST, [this]() {
        handleRestart();
    });

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
    Serial.printf("[HTTP] Petición GET / recibida desde %s\n", server_.client().remoteIP().toString().c_str());
    const auto& timing = config_->timing();
    const auto& connections = config_->connections();

    server_.send(
        200,
        "text/html",
        WebPages::dashboard(
            wifi_->isApMode(),
            wifi_->isConnected(),
            connections.bluetoothEnabled,
            bluetooth_->isConnected(),
            connections.tcpEnabled,
            socketServer_->connectedClients(),
            wifi_->ipAddress(),
            wifi_->storedSSID(),
            timing.doublePressWindowMs,
            timing.holdThresholdMs,
            timing.wifiResetHoldMs
        )
    );
}

void WebConfigServer::handleStatus() {
    const auto& connections = config_->connections();

    server_.send(
        200,
        "application/json",
        WebPages::jsonStatus(
            wifi_->isApMode(),
            wifi_->isConnected(),
            connections.bluetoothEnabled,
            bluetooth_->isConnected(),
            connections.tcpEnabled,
            socketServer_->connectedClients(),
            wifi_->ipAddress(),
            wifi_->storedSSID()
        )
    );
}

String WebConfigServer::requestBody() {
    if (server_.hasArg("plain")) {
        return server_.arg("plain");
    }

    return "";
}

String WebConfigServer::readString(
    const String& body,
    const char* key
) const {
    JsonDocument doc;

    if (deserializeJson(doc, body)) {
        return "";
    }

    return doc[key] | "";
}

bool WebConfigServer::readBool(
    const String& body,
    const char* key,
    bool fallback
) const {
    JsonDocument doc;

    if (deserializeJson(doc, body)) {
        return fallback;
    }

    return doc[key] | fallback;
}

unsigned long WebConfigServer::readUInt(
    const String& body,
    const char* key,
    unsigned long fallback
) const {
    JsonDocument doc;

    if (deserializeJson(doc, body)) {
        return fallback;
    }

    return doc[key] | fallback;
}

void WebConfigServer::handleConfig() {
    const String body = requestBody();

    auto& timing = config_->timing();
    auto& connections = config_->connections();

    if (body.isEmpty()) {
        server_.send(400, "text/plain", "JSON requerido");
        return;
    }

    timing.doublePressWindowMs =
        readUInt(body, "doublePressWindowMs", timing.doublePressWindowMs);

    timing.holdThresholdMs =
        readUInt(body, "holdThresholdMs", timing.holdThresholdMs);

    timing.wifiResetHoldMs =
        readUInt(body, "wifiResetHoldMs", timing.wifiResetHoldMs);

    connections.bluetoothEnabled =
        readBool(body, "bluetoothEnabled", connections.bluetoothEnabled);

    connections.tcpEnabled =
        readBool(body, "tcpEnabled", connections.tcpEnabled);

    config_->clamp();
    config_->save();

    bluetooth_->setEnabled(connections.bluetoothEnabled);
    socketServer_->setEnabled(connections.tcpEnabled);

    server_.send(200, "application/json", "{\"ok\":true}");
}

void WebConfigServer::handleConfigReset() {
    config_->reset();

    bluetooth_->setEnabled(config_->connections().bluetoothEnabled);
    socketServer_->setEnabled(config_->connections().tcpEnabled);

    server_.send(200, "application/json", "{\"ok\":true}");
}

void WebConfigServer::handleWifiScan() {
    if (!wifi_->isApMode()) {
        server_.send(
            403,
            "application/json",
            "{\"error\":\"El escaneo está disponible en modo AP.\"}"
        );
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
