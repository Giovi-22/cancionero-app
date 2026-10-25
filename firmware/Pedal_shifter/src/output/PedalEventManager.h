#pragma once

#include <Arduino.h>

#include "../input/PedalButtons.h"

class PedalConfig;
class BluetoothManager;
class PedalSocketServer;

class PedalEventManager {
public:
  void begin(PedalConfig &config, BluetoothManager &bluetooth,
             PedalSocketServer &socketServer);

  void handle(PedalEvent event);
  void update();

  void cancelActivePresses();

private:
  void logDelivery(const char *tcpMessage);
  void logDeliveryNamed(const char *name);

  PedalConfig *config_ = nullptr;
  BluetoothManager *bluetooth_ = nullptr;
  PedalSocketServer *socketServer_ = nullptr;

  void sendPress(const char *tcpMessage, char bleKey);
  void sendRelease(const char *tcpMessage, char bleKey);
  void sendWrite(const char *tcpMessage, char bleKey);

  /**
   * Un toque del modo "por secciones".
   * `name` es lo que se anota en el registro (UP_TAP / DOWN_TAP).
   * `tcpMessages` son las líneas que reciben las apps por TCP: un
   * PRESS y un RELEASE seguidos, para que una app que todavía no entienda
   * los toques salte igual (reacciona al PRESS e ignora el RELEASE).
   * Por Bluetooth sale una sola tecla.
   */
  void sendTap(const char *name, const char *tcpMessages, char bleKey);
};