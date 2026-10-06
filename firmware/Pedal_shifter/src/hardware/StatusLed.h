#pragma once

#include <Arduino.h>

class StatusLed {
public:
    static constexpr uint8_t PIN = 16;

    void begin();

    void update(
        bool bluetoothConnected,
        bool wifiConnected,
        bool apMode,
        bool tcpEnabled,
        uint8_t tcpClients,
        bool bothButtonsActive
    );

private:
    unsigned long lastBlink_ = 0;
    bool state_ = false;
};
