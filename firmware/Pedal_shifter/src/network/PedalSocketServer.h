#pragma once

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiServer.h>
#include <WiFiUdp.h>

#include "PedalSyncModel.h"

class PedalConfig;
class WiFiManager;

class PedalSocketServer : private ISyncSink {
public:
  static constexpr uint16_t PORT = 8080;
  static constexpr uint16_t UDP_DISCOVERY_PORT = 4444;
  static constexpr unsigned long DISCOVERY_INTERVAL_MS = 3000;
  static constexpr uint8_t MAX_CLIENTS = 7;

  void begin(PedalConfig &config, WiFiManager &wifi);
  void update();

  void setEnabled(bool enabled);
  bool isEnabled() const;

  bool isRunning() const;
  bool hasClients();
  uint8_t connectedClients();

  void broadcast(const char *message);

  // Posición compartida: los llama PedalEventManager junto con cada evento.
  // dir: -1 = arriba, +1 = abajo.
  void syncMotionStart(int8_t dir);
  void syncMotionStop();
  void syncHome();
  void syncEnd();

private:
  PedalConfig *config_ = nullptr;
  WiFiManager *wifi_ = nullptr;

  WiFiServer server_{PORT};
  WiFiUDP udp_;
  WiFiClient clients_[MAX_CLIENTS];

  // Buffer de recepción por cliente (los mensajes del cliente son líneas
  // cortas).
  static constexpr size_t RX_MAX = 128;
  static constexpr size_t RX_BYTES_PER_UPDATE = 256;
  char rx_[MAX_CLIENTS][RX_MAX];
  size_t rxLen_[MAX_CLIENTS] = {0};
  bool rxOverflow_[MAX_CLIENTS] = {false};

  PedalSyncModel sync_;

  bool running_ = false;
  unsigned long lastBroadcast_ = 0;

  void startServer();
  void stopServer();

  void acceptClients();
  void cleanClients();
  void readClients();
  void broadcastDiscovery();

  // ISyncSink
  void sendToSlot(uint8_t slot, const char *line) override;
  void log(const char *message) override;
};
