#include "PedalEventManager.h"

#include "../bluetooth/BluetoothManager.h"
#include "../network/PedalSocketServer.h"
#include "../config/PedalConfig.h"

void PedalEventManager::begin(
    PedalConfig& config,
    BluetoothManager& bluetooth,
    PedalSocketServer& socketServer
) {
    config_ = &config;
    bluetooth_ = &bluetooth;
    socketServer_ = &socketServer;
}

void PedalEventManager::update() {
}

void PedalEventManager::sendPress(
    const char* tcpMessage,
    char bleKey
) {
    if (config_->connections().tcpEnabled && socketServer_->hasClients()) {
        socketServer_->broadcast(tcpMessage);
    }

    if (config_->connections().bluetoothEnabled &&
        bluetooth_->isConnected()) {
        bluetooth_->press(bleKey);
    }
}

void PedalEventManager::sendRelease(
    const char* tcpMessage,
    char bleKey
) {
    if (config_->connections().tcpEnabled && socketServer_->hasClients()) {
        socketServer_->broadcast(tcpMessage);
    }

    if (config_->connections().bluetoothEnabled &&
        bluetooth_->isConnected()) {
        bluetooth_->release(bleKey);
    }
}

void PedalEventManager::sendWrite(
    const char* tcpMessage,
    char bleKey
) {
    if (config_->connections().tcpEnabled && socketServer_->hasClients()) {
        socketServer_->broadcast(tcpMessage);
    }

    if (config_->connections().bluetoothEnabled &&
        bluetooth_->isConnected()) {
        bluetooth_->write(bleKey);
    }
}

void PedalEventManager::handle(PedalEvent event) {
    switch (event) {
        case PedalEvent::UP_PRESS:
            sendPress("UP_PRESS\n", '1');
            break;

        case PedalEvent::UP_RELEASE:
            sendRelease("UP_RELEASE\n", '1');
            break;

        case PedalEvent::DOWN_PRESS:
            sendPress("DOWN_PRESS\n", '2');
            break;

        case PedalEvent::DOWN_RELEASE:
            sendRelease("DOWN_RELEASE\n", '2');
            break;

        case PedalEvent::HOME:
            Serial.println("[Evento] HOME");
            sendWrite("HOME\n", 'h');
            break;

        case PedalEvent::END:
            Serial.println("[Evento] END");
            sendWrite("END\n", 'e');
            break;
    }
}

void PedalEventManager::cancelActivePresses() {
    sendRelease("UP_RELEASE\n", '1');
    sendRelease("DOWN_RELEASE\n", '2');
}
