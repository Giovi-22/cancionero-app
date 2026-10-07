#pragma once

#include <Arduino.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <WiFi.h>

class PedalConfig;

class WiFiManager {
public:
    static constexpr uint16_t HTTP_PORT = 80;
    static constexpr char AP_SSID[] = "PedalConfig_wifi";
    static constexpr char AP_PASSWORD[] = "config1234";
    static constexpr char MDNS_HOST[] = "pedalshifter";

    void begin(PedalConfig& config);
    void update();

    bool isConnected() const;
    bool isApMode() const;

    String ipAddress() const;

    String storedSSID() const;

    bool saveCredentials(const String& ssid, const String& password);
    void clearCredentials();

    void resetCredentialsAndRestart();

private:
    PedalConfig* config_ = nullptr;

    Preferences prefs_;
    DNSServer dns_;

    bool apMode_ = false;
    bool mdnsStarted_ = false;

    unsigned long connectStarted_ = 0;
    bool connecting_ = false;
    bool wasConnected_ = false;
    unsigned long lastReconnectAttempt_ = 0;

    void startStation();
    void startAP();
    void startMDNS();

    String readSSID() const;
    String readPassword() const;
};
