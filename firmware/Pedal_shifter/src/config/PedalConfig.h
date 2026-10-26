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

/**
 * Cómo se comporta el pedal:
 *
 *  - LINES:    scroll continuo por líneas (mantener apretado). Es el modo
 *              de siempre y el que viene por defecto.
 *  - SECTIONS: un toque corto salta a la sección siguiente / anterior.
 *              Mantener apretado lleva al inicio (arriba) o al final (abajo).
 */
enum class PedalMode : uint8_t {
    LINES = 0,
    SECTIONS = 1
};

struct PedalBehaviorConfig {
    PedalMode mode;

    // Porcentaje del alto de la pantalla que queda arriba de la sección
    // (contexto del verso anterior). Solo modo SECTIONS.
    uint8_t overlapPercent;

    // Cuánto hay que mantener apretado para ir al inicio / final (ms).
    // Solo modo SECTIONS. Un toque más corto que esto cuenta como toque.
    unsigned long sectionHoldMs;
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

    static constexpr uint8_t DEFAULT_OVERLAP_PERCENT = 30;
    static constexpr uint8_t MIN_OVERLAP_PERCENT = 0;
    static constexpr uint8_t MAX_OVERLAP_PERCENT = 60;

    static constexpr unsigned long DEFAULT_SECTION_HOLD_MS = 1500;
    static constexpr unsigned long MIN_SECTION_HOLD_MS = 600;
    static constexpr unsigned long MAX_SECTION_HOLD_MS = 5000;

    void begin();

    const PedalTimingConfig& timing() const;
    const PedalConnectionConfig& connections() const;
    const PedalBehaviorConfig& behavior() const;

    PedalTimingConfig& timing();
    PedalConnectionConfig& connections();
    PedalBehaviorConfig& behavior();

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

    PedalBehaviorConfig behavior_{
        PedalMode::LINES,
        DEFAULT_OVERLAP_PERCENT,
        DEFAULT_SECTION_HOLD_MS
    };
};