#pragma once

#include <Arduino.h>
#include <WebServer.h>

class PedalConfig;
class WiFiManager;
class BluetoothManager;
class PedalSocketServer;
class PedalButtons;

class WebConfigServer {
public:
  void begin(PedalConfig &config, WiFiManager &wifi,
             BluetoothManager &bluetooth, PedalSocketServer &socketServer,
             PedalButtons &buttons);

  void update();

private:
  WebServer server_{80};

  PedalConfig *config_ = nullptr;
  WiFiManager *wifi_ = nullptr;
  BluetoothManager *bluetooth_ = nullptr;
  PedalSocketServer *socketServer_ = nullptr;
  PedalButtons *buttons_ = nullptr;

  bool started_ = false;

  void setupRoutes();

  void handleRoot();
  void handleStatus();
  void handleConfig();
  void handleConfigReset();

  void handleWifiScan();
  void handleWifiSave();
  void handleWifiReset();

  void handleRestart();

  void handleDiagPage();
  void handleDiagData();
  void handleDiagClear();

  String requestBody();
  bool readBool(const String &body, const char *key, bool fallback) const;
  unsigned long readUInt(const String &body, const char *key,
                         unsigned long fallback) const;

  String readString(const String &body, const char *key) const;
};