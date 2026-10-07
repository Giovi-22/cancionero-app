#pragma once

#include <Arduino.h>

#include "../input/PedalButtons.h"

class PedalConfig;
class BluetoothManager;
class PedalSocketServer;

class PedalEventManager {
public:
    void begin(
        PedalConfig& config,
        BluetoothManager& bluetooth,
        PedalSocketServer& socketServer
    );

    void handle(PedalEvent event);
    void update();

    void cancelActivePresses();

private:
    PedalConfig* config_ = nullptr;
    BluetoothManager* bluetooth_ = nullptr;
    PedalSocketServer* socketServer_ = nullptr;

    void sendPress(const char* tcpMessage, char bleKey);
    void sendRelease(const char* tcpMessage, char bleKey);
    void sendWrite(const char* tcpMessage, char bleKey);
};
