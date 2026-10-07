#pragma once

#include <Arduino.h>

struct PedalTimingConfig {
    unsigned long doublePressWindowMs;
    unsigned long holdThresholdMs;
    unsigned long wifiResetHoldMs;
};

struct PedalConnectionConfig {
    bool bluetoothEnabled;
    bool tcpEnabled;
};

class PedalConfig {
public:
    static constexpr unsigned long DEFAULT_DOUBLE_PRESS_WINDOW_MS = 500;
    static constexpr unsigned long DEFAULT_HOLD_THRESHOLD_MS = 500;
    static constexpr unsigned long DEFAULT_WIFI_RESET_HOLD_MS = 3000;

    static constexpr unsigned long MIN_DOUBLE_PRESS_WINDOW_MS = 150;
    static constexpr unsigned long MAX_DOUBLE_PRESS_WINDOW_MS = 1500;

    static constexpr unsigned long MIN_HOLD_THRESHOLD_MS = 150;
    static constexpr unsigned long MAX_HOLD_THRESHOLD_MS = 3000;

    static constexpr unsigned long MIN_WIFI_RESET_HOLD_MS = 1000;
    static constexpr unsigned long MAX_WIFI_RESET_HOLD_MS = 10000;

    void begin();

    const PedalTimingConfig& timing() const;
    const PedalConnectionConfig& connections() const;

    PedalTimingConfig& timing();
    PedalConnectionConfig& connections();

    void save();
    void reset();

    void clamp();

private:
    PedalTimingConfig timing_{
        DEFAULT_DOUBLE_PRESS_WINDOW_MS,
        DEFAULT_HOLD_THRESHOLD_MS,
        DEFAULT_WIFI_RESET_HOLD_MS
    };

    PedalConnectionConfig connections_{
        true,
        true
    };
};
