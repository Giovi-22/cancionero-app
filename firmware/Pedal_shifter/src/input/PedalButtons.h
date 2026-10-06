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

class PedalButtons {
public:
    using EventCallback = std::function<void(PedalEvent)>;
    using WifiResetCallback = std::function<void()>;

    static constexpr uint8_t PIN_UP = 17;
    static constexpr uint8_t PIN_DOWN = 18;

    void begin(PedalConfig& config);

    void update(unsigned long now);

    void setEventCallback(EventCallback callback);
    void setWifiResetCallback(WifiResetCallback callback);

    bool bothButtonsActive() const;

private:
    enum class State {
        IDLE,
        FIRST_PRESS,
        WAITING_DOUBLE,
        SECOND_PRESS,
        SCROLLING
    };

    PedalConfig* config_ = nullptr;

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

    void updateUp(bool pressed, unsigned long now);
    void updateDown(bool pressed, unsigned long now);

    bool checkWifiReset(bool upPressed, bool downPressed, unsigned long now);
    void cancelButtonStates();

    void emit(PedalEvent event);
};
