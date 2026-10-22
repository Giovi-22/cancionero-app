#pragma once

#include <Arduino.h>
#include <functional>

class PedalConfig;

enum class PedalEvent {
  UP_PRESS,
  UP_RELEASE,
  DOWN_PRESS,
  DOWN_RELEASE,
  HOME,
  END
};

/**
 * Estado de los pulsadores para la página de diagnóstico.
 * "Crudo" = nivel del pin ahora mismo; "estable" = después del antirrebote.
 */
struct ButtonSnapshot {
  bool upRaw;
  bool downRaw;
  bool upStable;
  bool downStable;

  const char *upState;
  const char *downState;
  uint32_t upStateMs; // hace cuánto está en ese estado
  uint32_t downStateMs;

  uint16_t upEdges10s; // cambios de nivel crudos en los últimos 10 s (máx. 32)
  uint16_t downEdges10s;
  uint32_t upEdgesTotal;
  uint32_t downEdgesTotal;

  bool bothActive;
  uint16_t debounceMs;
};

class PedalButtons {
public:
  using EventCallback = std::function<void(PedalEvent)>;
  using WifiResetCallback = std::function<void()>;

  static constexpr uint8_t PIN_UP = 17;
  static constexpr uint8_t PIN_DOWN = 18;

  void begin(PedalConfig &config);

  void update(unsigned long now);

  void setEventCallback(EventCallback callback);
  void setWifiResetCallback(WifiResetCallback callback);

  bool bothButtonsActive() const;

  ButtonSnapshot snapshot(unsigned long now) const;

private:
  enum class State {
    IDLE,
    FIRST_PRESS,
    WAITING_DOUBLE,
    SECOND_PRESS,
    SCROLLING
  };

  PedalConfig *config_ = nullptr;

  EventCallback eventCallback_;
  WifiResetCallback wifiResetCallback_;

  State upState_ = State::IDLE;
  State downState_ = State::IDLE;

  unsigned long upPressStart_ = 0;
  unsigned long downPressStart_ = 0;

  unsigned long upFirstRelease_ = 0;
  unsigned long downFirstRelease_ = 0;

  unsigned long lastDebounceUp_ = 0;
  unsigned long lastDebounceDown_ = 0;

  bool lastRawUp_ = HIGH;
  bool lastRawDown_ = HIGH;

  bool debouncedUp_ = HIGH;
  bool debouncedDown_ = HIGH;

  bool bothButtonsActive_ = false;
  unsigned long bothButtonsStart_ = 0;

  static constexpr unsigned long DEBOUNCE_MS = 50;

  // Pausas más cortas que esto entre soltar y apretar se marcan en el registro.
  static constexpr unsigned long CUT_HINT_MS = 150;

  // ── Telemetría para el diagnóstico ──
  struct EdgeTracker {
    static constexpr uint8_t SIZE = 32;

    unsigned long times[SIZE] = {0};
    uint8_t head = 0;
    uint8_t count = 0;
    uint32_t total = 0;
    uint16_t sinceStable = 0;

    // Para detectar cortes: cuándo se soltó por última vez.
    unsigned long lastReleaseAt = 0;
    bool hasRelease = false;

    void record(unsigned long now);
    uint16_t within(unsigned long now, unsigned long windowMs) const;
  };

  EdgeTracker upEdges_;
  EdgeTracker downEdges_;

  unsigned long upStateSince_ = 0;
  unsigned long downStateSince_ = 0;

  static const char *stateName(State state);
  void logStableChange(const char *name, uint8_t pin, bool pressed,
                       EdgeTracker &edges, unsigned long now);

  void updateUp(bool pressed, unsigned long now);
  void updateDown(bool pressed, unsigned long now);

  bool checkWifiReset(bool upPressed, bool downPressed, unsigned long now);
  void cancelButtonStates();

  void emit(PedalEvent event);
};