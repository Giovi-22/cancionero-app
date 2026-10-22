#include "PedalEventManager.h"

#include "../bluetooth/BluetoothManager.h"
#include "../config/PedalConfig.h"
#include "../diag/PedalDiag.h"
#include "../network/PedalSocketServer.h"


#include <string.h>

void PedalEventManager::begin(PedalConfig &config, BluetoothManager &bluetooth,
                              PedalSocketServer &socketServer) {
  config_ = &config;
  bluetooth_ = &bluetooth;
  socketServer_ = &socketServer;
}

void PedalEventManager::update() {}

/**
 * Deja en el registro qué evento se envió y por qué canales salió.
 * Es lo que permite ver, desde la página de diagnóstico, si el pedal
 * mandó el evento aunque la app no haya reaccionado.
 */
void PedalEventManager::logDelivery(const char *tcpMessage) {
  char name[24];
  size_t length = strcspn(tcpMessage, "\r\n");

  if (length >= sizeof(name)) {
    length = sizeof(name) - 1;
  }

  memcpy(name, tcpMessage, length);
  name[length] = '\0';

  char tcp[24];

  if (!config_->connections().tcpEnabled) {
    snprintf(tcp, sizeof(tcp), "desactivado");
  } else {
    snprintf(tcp, sizeof(tcp), "%u cliente(s)",
             static_cast<unsigned>(socketServer_->connectedClients()));
  }

  const char *ble = "desactivado";

  if (config_->connections().bluetoothEnabled) {
    ble = bluetooth_->isConnected() ? "enviado" : "sin conexión";
  }

  PedalDiag::add(PedalDiag::Cat::EVT, "%s -> TCP: %s | BLE: %s", name, tcp,
                 ble);
}

void PedalEventManager::sendPress(const char *tcpMessage, char bleKey) {
  logDelivery(tcpMessage);

  if (config_->connections().tcpEnabled && socketServer_->hasClients()) {
    socketServer_->broadcast(tcpMessage);
  }

  if (config_->connections().bluetoothEnabled && bluetooth_->isConnected()) {
    bluetooth_->press(bleKey);
  }
}

void PedalEventManager::sendRelease(const char *tcpMessage, char bleKey) {
  logDelivery(tcpMessage);

  if (config_->connections().tcpEnabled && socketServer_->hasClients()) {
    socketServer_->broadcast(tcpMessage);
  }

  if (config_->connections().bluetoothEnabled && bluetooth_->isConnected()) {
    bluetooth_->release(bleKey);
  }
}

void PedalEventManager::sendWrite(const char *tcpMessage, char bleKey) {
  logDelivery(tcpMessage);

  if (config_->connections().tcpEnabled && socketServer_->hasClients()) {
    socketServer_->broadcast(tcpMessage);
  }

  if (config_->connections().bluetoothEnabled && bluetooth_->isConnected()) {
    bluetooth_->write(bleKey);
  }
}

void PedalEventManager::handle(PedalEvent event) {
  switch (event) {
  case PedalEvent::UP_PRESS:
    sendPress("UP_PRESS\n", '1');
    socketServer_->syncMotionStart(-1);
    break;

  case PedalEvent::UP_RELEASE:
    sendRelease("UP_RELEASE\n", '1');
    socketServer_->syncMotionStop();
    break;

  case PedalEvent::DOWN_PRESS:
    sendPress("DOWN_PRESS\n", '2');
    socketServer_->syncMotionStart(+1);
    break;

  case PedalEvent::DOWN_RELEASE:
    sendRelease("DOWN_RELEASE\n", '2');
    socketServer_->syncMotionStop();
    break;

  case PedalEvent::HOME:
    Serial.println("[Evento] HOME");
    sendWrite("HOME\n", 'h');
    socketServer_->syncHome();
    break;

  case PedalEvent::END:
    Serial.println("[Evento] END");
    sendWrite("END\n", 'e');
    socketServer_->syncEnd();
    break;
  }
}

void PedalEventManager::cancelActivePresses() {
  sendRelease("UP_RELEASE\n", '1');
  sendRelease("DOWN_RELEASE\n", '2');
  socketServer_->syncMotionStop();
}