#include "PedalConfig.h"

#include <Preferences.h>

namespace {
Preferences prefs;
}

void PedalConfig::begin() {
    prefs.begin("pedal", true);

    timing_.doublePressWindowMs =
        prefs.getUInt("doubleWindow", DEFAULT_DOUBLE_PRESS_WINDOW_MS);

    timing_.holdThresholdMs =
        prefs.getUInt("holdThreshold", DEFAULT_HOLD_THRESHOLD_MS);

    timing_.wifiResetHoldMs =
        prefs.getUInt("wifiResetHold", DEFAULT_WIFI_RESET_HOLD_MS);

    connections_.bluetoothEnabled =
        prefs.getBool("bluetooth", true);

    connections_.tcpEnabled =
        prefs.getBool("tcp", true);

    prefs.end();

    clamp();

    Serial.println("[Config] Pedal:");
    Serial.printf("  Double window: %lu ms\n", timing_.doublePressWindowMs);
    Serial.printf("  Hold threshold: %lu ms\n", timing_.holdThresholdMs);
    Serial.printf("  WiFi reset hold: %lu ms\n", timing_.wifiResetHoldMs);
    Serial.printf("  Bluetooth: %s\n", connections_.bluetoothEnabled ? "ON" : "OFF");
    Serial.printf("  TCP server: %s\n", connections_.tcpEnabled ? "ON" : "OFF");
}

const PedalTimingConfig& PedalConfig::timing() const {
    return timing_;
}

const PedalConnectionConfig& PedalConfig::connections() const {
    return connections_;
}

PedalTimingConfig& PedalConfig::timing() {
    return timing_;
}

PedalConnectionConfig& PedalConfig::connections() {
    return connections_;
}

void PedalConfig::clamp() {
    timing_.doublePressWindowMs = constrain(
        timing_.doublePressWindowMs,
        MIN_DOUBLE_PRESS_WINDOW_MS,
        MAX_DOUBLE_PRESS_WINDOW_MS
    );

    timing_.holdThresholdMs = constrain(
        timing_.holdThresholdMs,
        MIN_HOLD_THRESHOLD_MS,
        MAX_HOLD_THRESHOLD_MS
    );

    timing_.wifiResetHoldMs = constrain(
        timing_.wifiResetHoldMs,
        MIN_WIFI_RESET_HOLD_MS,
        MAX_WIFI_RESET_HOLD_MS
    );
}

void PedalConfig::save() {
    clamp();

    prefs.begin("pedal", false);

    prefs.putUInt("doubleWindow", timing_.doublePressWindowMs);
    prefs.putUInt("holdThreshold", timing_.holdThresholdMs);
    prefs.putUInt("wifiResetHold", timing_.wifiResetHoldMs);
    prefs.putBool("bluetooth", connections_.bluetoothEnabled);
    prefs.putBool("tcp", connections_.tcpEnabled);

    prefs.end();

    Serial.println("[Config] Guardada.");
}

void PedalConfig::reset() {
    timing_.doublePressWindowMs = DEFAULT_DOUBLE_PRESS_WINDOW_MS;
    timing_.holdThresholdMs = DEFAULT_HOLD_THRESHOLD_MS;
    timing_.wifiResetHoldMs = DEFAULT_WIFI_RESET_HOLD_MS;

    connections_.bluetoothEnabled = true;
    connections_.tcpEnabled = true;

    save();
}
