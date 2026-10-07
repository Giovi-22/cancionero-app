#include "StatusLed.h"

void StatusLed::begin() {
    pinMode(PIN, OUTPUT);
    digitalWrite(PIN, LOW);
}

void StatusLed::update(
    bool bluetoothConnected,
    bool wifiConnected,
    bool apMode,
    bool tcpEnabled,
    uint8_t tcpClients,
    bool bothButtonsActive
) {
    if (bothButtonsActive) {
        const unsigned long now = millis();

        if (now - lastBlink_ >= 150) {
            lastBlink_ = now;
            state_ = !state_;
            digitalWrite(PIN, state_);
        }

        return;
    }

    if (apMode) {
        const unsigned long now = millis();

        if (now - lastBlink_ >= 500) {
            lastBlink_ = now;
            state_ = !state_;
            digitalWrite(PIN, state_);
        }

        return;
    }

    if (bluetoothConnected || (wifiConnected && tcpEnabled && tcpClients > 0)) {
        digitalWrite(PIN, HIGH);
        return;
    }

    const unsigned long now = millis();

    if (now - lastBlink_ >= 500) {
        lastBlink_ = now;
        state_ = !state_;
        digitalWrite(PIN, state_);
    }
}
