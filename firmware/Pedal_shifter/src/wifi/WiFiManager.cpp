#include "WiFiManager.h"

#include "../config/PedalConfig.h"

constexpr char WiFiManager::AP_SSID[];
constexpr char WiFiManager::AP_PASSWORD[];
constexpr char WiFiManager::MDNS_HOST[];

void WiFiManager::begin(PedalConfig& config) {
    config_ = &config;

    // En ESP32, Wi-Fi y Bluetooth comparten la radio (coexistencia RF).
    // ESP-IDF exige modem sleep habilitado cuando ambos están en uso para evitar abort().
    WiFi.setSleep(true);

    const String ssid = readSSID();

    if (ssid.isEmpty()) {
        Serial.println("[WiFi] No hay credenciales. Iniciando AP.");
        startAP();
        return;
    }

    startStation();
}

void WiFiManager::update() {
    if (apMode_) {
        dns_.processNextRequest();
        return;
    }

    if (connecting_) {
        if (WiFi.status() == WL_CONNECTED) {
            connecting_ = false;
            wasConnected_ = true;

            Serial.println("================================");
            Serial.println("[WiFi] CONECTADO EXITOSAMENTE");
            Serial.print("[WiFi] SSID: ");
            Serial.println(WiFi.SSID());
            Serial.print("[WiFi] IP asignada: ");
            Serial.println(WiFi.localIP());
            Serial.print("[WiFi] Servidor Web: http://");
            Serial.println(WiFi.localIP());
            Serial.println("================================");

            startMDNS();
            return;
        }

        if (millis() - connectStarted_ >= 30000) {
            connecting_ = false;

            Serial.println("[WiFi] Timeout (30s) al conectar. Pasando a modo AP.");

            WiFi.disconnect(true);
            delay(100);
            startAP();
        }
    } else if (wasConnected_) {
        if (WiFi.status() != WL_CONNECTED) {
            const unsigned long now = millis();
            if (now - lastReconnectAttempt_ >= 5000) {
                lastReconnectAttempt_ = now;
                Serial.println("[WiFi] Conexión perdida con el router. Intentando reconectar...");
                WiFi.reconnect();
            }
        }
    }
}

bool WiFiManager::isConnected() const {
    return !apMode_ && WiFi.status() == WL_CONNECTED;
}

bool WiFiManager::isApMode() const {
    return apMode_;
}

String WiFiManager::ipAddress() const {
    if (apMode_) {
        return WiFi.softAPIP().toString();
    }

    return WiFi.localIP().toString();
}

String WiFiManager::readSSID() const {
    Preferences prefs;
    prefs.begin("wifi", true);
    String value = prefs.getString("ssid", "");
    prefs.end();
    return value;
}

String WiFiManager::readPassword() const {
    Preferences prefs;
    prefs.begin("wifi", true);
    String value = prefs.getString("pass", "");
    prefs.end();
    return value;
}

String WiFiManager::storedSSID() const {
    return readSSID();
}

bool WiFiManager::saveCredentials(
    const String& ssid,
    const String& password
) {
    if (ssid.isEmpty()) {
        return false;
    }

    prefs_.begin("wifi", false);
    prefs_.putString("ssid", ssid);
    prefs_.putString("pass", password);
    prefs_.end();

    Serial.println("[WiFi] Credenciales guardadas.");
    return true;
}

void WiFiManager::clearCredentials() {
    prefs_.begin("wifi", false);
    prefs_.clear();
    prefs_.end();

    Serial.println("[WiFi] Credenciales eliminadas.");
}

void WiFiManager::resetCredentialsAndRestart() {
    clearCredentials();

    delay(300);
    ESP.restart();
}

void WiFiManager::startStation() {
    const String ssid = readSSID();
    const String password = readPassword();

    Serial.println("[WiFi] Iniciando STA.");
    Serial.print("[WiFi] SSID: ");
    Serial.println(ssid);

    apMode_ = false;
    connecting_ = true;
    wasConnected_ = false;
    connectStarted_ = millis();

    WiFi.mode(WIFI_STA);
    WiFi.setSleep(true);
    WiFi.setAutoReconnect(true);
    WiFi.begin(ssid.c_str(), password.c_str());
}

void WiFiManager::startAP() {
    apMode_ = true;
    connecting_ = false;
    mdnsStarted_ = false;

    WiFi.mode(WIFI_AP);

    if (!WiFi.softAP(AP_SSID, AP_PASSWORD)) {
        Serial.println("[WiFi] ERROR iniciando AP.");
        return;
    }

    const IPAddress ip = WiFi.softAPIP();

    Serial.println("================================");
    Serial.println("[WiFi] MODO CONFIGURACION");
    Serial.print("[WiFi] SSID: ");
    Serial.println(AP_SSID);
    Serial.print("[WiFi] IP: ");
    Serial.println(ip);
    Serial.println("================================");

    dns_.start(53, "*", ip);
}

void WiFiManager::startMDNS() {
    if (mdnsStarted_) {
        return;
    }

    if (MDNS.begin(MDNS_HOST)) {
        mdnsStarted_ = true;
        MDNS.addService("pedal", "tcp", 8080);

        Serial.print("[mDNS] http://");
        Serial.print(MDNS_HOST);
        Serial.println(".local");
    }
}
