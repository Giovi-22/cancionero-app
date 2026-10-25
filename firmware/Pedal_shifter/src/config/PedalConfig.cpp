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

    // Las claves de NVS tienen un máximo de 15 caracteres.
    behavior_.mode = static_cast<PedalMode>(
        prefs.getUChar("mode", static_cast<uint8_t>(PedalMode::LINES))
    );

    behavior_.overlapPercent =
        prefs.getUChar("overlap", DEFAULT_OVERLAP_PERCENT);

    behavior_.sectionHoldMs =
        prefs.getUInt("sectionHold", DEFAULT_SECTION_HOLD_MS);

    prefs.end();

    clamp();

    Serial.println("[Config] Pedal:");
    Serial.printf("  Double window: %lu ms\n", timing_.doublePressWindowMs);
    Serial.printf("  Hold threshold: %lu ms\n", timing_.holdThresholdMs);
    Serial.printf("  WiFi reset hold: %lu ms\n", timing_.wifiResetHoldMs);
    Serial.printf("  Bluetooth: %s\n", connections_.bluetoothEnabled ? "ON" : "OFF");
    Serial.printf("  TCP server: %s\n", connections_.tcpEnabled ? "ON" : "OFF");
    Serial.printf("  Modo: %s\n",
                  behavior_.mode == PedalMode::SECTIONS ? "SECCIONES" : "LINEAS");
    Serial.printf("  Contexto de seccion: %u %%\n", behavior_.overlapPercent);
    Serial.printf("  Mantener para inicio/final: %lu ms\n", behavior_.sectionHoldMs);
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

const PedalBehaviorConfig& PedalConfig::behavior() const {
    return behavior_;
}

PedalBehaviorConfig& PedalConfig::behavior() {
    return behavior_;
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

    // Un valor guardado que no sea un modo conocido vuelve al modo de siempre.
    if (behavior_.mode != PedalMode::LINES &&
        behavior_.mode != PedalMode::SECTIONS) {
        behavior_.mode = PedalMode::LINES;
    }

    if (behavior_.overlapPercent < MIN_OVERLAP_PERCENT) {
        behavior_.overlapPercent = MIN_OVERLAP_PERCENT;
    } else if (behavior_.overlapPercent > MAX_OVERLAP_PERCENT) {
        behavior_.overlapPercent = MAX_OVERLAP_PERCENT;
    }

    behavior_.sectionHoldMs = constrain(
        behavior_.sectionHoldMs,
        MIN_SECTION_HOLD_MS,
        MAX_SECTION_HOLD_MS
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
    prefs.putUChar("mode", static_cast<uint8_t>(behavior_.mode));
    prefs.putUChar("overlap", behavior_.overlapPercent);
    prefs.putUInt("sectionHold", behavior_.sectionHoldMs);

    prefs.end();

    Serial.println("[Config] Guardada.");
}

void PedalConfig::reset() {
    timing_.doublePressWindowMs = DEFAULT_DOUBLE_PRESS_WINDOW_MS;
    timing_.holdThresholdMs = DEFAULT_HOLD_THRESHOLD_MS;
    timing_.wifiResetHoldMs = DEFAULT_WIFI_RESET_HOLD_MS;

    connections_.bluetoothEnabled = true;
    connections_.tcpEnabled = true;

    behavior_.mode = PedalMode::LINES;
    behavior_.overlapPercent = DEFAULT_OVERLAP_PERCENT;
    behavior_.sectionHoldMs = DEFAULT_SECTION_HOLD_MS;

    save();
}