#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiServer.h>
#include <WiFiUdp.h>

class PedalConfig;
class WiFiManager;

class PedalSocketServer {
public:
    static constexpr uint16_t PORT = 8080;
    static constexpr uint16_t UDP_DISCOVERY_PORT = 4444;
    static constexpr unsigned long DISCOVERY_INTERVAL_MS = 3000;
    static constexpr uint8_t MAX_CLIENTS = 7;

    void begin(PedalConfig& config, WiFiManager& wifi);
    void update();

    void setEnabled(bool enabled);
    bool isEnabled() const;

    bool isRunning() const;
    bool hasClients();
    uint8_t connectedClients();

    void broadcast(const char* message);

private:
    PedalConfig* config_ = nullptr;
    WiFiManager* wifi_ = nullptr;

    WiFiServer server_{PORT};
    WiFiUDP udp_;
    WiFiClient clients_[MAX_CLIENTS];

    bool running_ = false;
    unsigned long lastBroadcast_ = 0;

    void startServer();
    void stopServer();

    void acceptClients();
    void cleanClients();
    void broadcastDiscovery();
};
