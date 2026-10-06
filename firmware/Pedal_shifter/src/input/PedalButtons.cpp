#include "PedalButtons.h"

#include "../config/PedalConfig.h"

void PedalButtons::begin(PedalConfig& config) {
    config_ = &config;

    pinMode(PIN_UP, INPUT_PULLUP);
    pinMode(PIN_DOWN, INPUT_PULLUP);

    lastRawUp_ = digitalRead(PIN_UP);
    lastRawDown_ = digitalRead(PIN_DOWN);

    debouncedUp_ = lastRawUp_;
    debouncedDown_ = lastRawDown_;

    Serial.println("[Buttons] Inicializados.");
}

void PedalButtons::setEventCallback(EventCallback callback) {
    eventCallback_ = callback;
}

void PedalButtons::setWifiResetCallback(WifiResetCallback callback) {
    wifiResetCallback_ = callback;
}

void PedalButtons::emit(PedalEvent event) {
    if (eventCallback_) {
        eventCallback_(event);
    }
}

bool PedalButtons::bothButtonsActive() const {
    return bothButtonsActive_;
}

void PedalButtons::update(unsigned long now) {
    bool rawUp = digitalRead(PIN_UP);
    bool rawDown = digitalRead(PIN_DOWN);

    if (rawUp != lastRawUp_) {
        lastDebounceUp_ = now;
        lastRawUp_ = rawUp;
    }

    if (now - lastDebounceUp_ >= DEBOUNCE_MS) {
        debouncedUp_ = rawUp;
    }

    if (rawDown != lastRawDown_) {
        lastDebounceDown_ = now;
        lastRawDown_ = rawDown;
    }

    if (now - lastDebounceDown_ >= DEBOUNCE_MS) {
        debouncedDown_ = rawDown;
    }

    const bool upPressed = debouncedUp_ == LOW;
    const bool downPressed = debouncedDown_ == LOW;

    if (checkWifiReset(upPressed, downPressed, now)) {
        return;
    }

    updateUp(upPressed, now);
    updateDown(downPressed, now);
}

bool PedalButtons::checkWifiReset(
    bool upPressed,
    bool downPressed,
    unsigned long now
) {
    if (upPressed && downPressed) {
        if (!bothButtonsActive_) {
            bothButtonsActive_ = true;
            bothButtonsStart_ = now;

            Serial.println("[WiFi] Ambos botones presionados.");
        }

        if (now - bothButtonsStart_ >= config_->timing().wifiResetHoldMs) {
            Serial.println("[WiFi] Reset solicitado.");

            cancelButtonStates();

            if (wifiResetCallback_) {
                wifiResetCallback_();
            }

            return true;
        }

        return true;
    }

    if (bothButtonsActive_) {
        bothButtonsActive_ = false;
        Serial.println("[WiFi] Reset cancelado.");
    }

    return false;
}

void PedalButtons::cancelButtonStates() {
    upState_ = State::IDLE;
    downState_ = State::IDLE;

    upPressStart_ = 0;
    downPressStart_ = 0;

    upFirstRelease_ = 0;
    downFirstRelease_ = 0;
}

void PedalButtons::updateUp(bool pressed, unsigned long now) {
    const auto& timing = config_->timing();

    switch (upState_) {
        case State::IDLE:
            if (pressed) {
                upState_ = State::FIRST_PRESS;
                upPressStart_ = now;
                Serial.println("[BTN UP] Primer press");
            }
            break;

        case State::FIRST_PRESS:
            if (!pressed) {
                const unsigned long duration = now - upPressStart_;

                if (duration >= timing.holdThresholdMs) {
                    emit(PedalEvent::UP_RELEASE);
                    upState_ = State::IDLE;
                } else {
                    upFirstRelease_ = now;
                    upState_ = State::WAITING_DOUBLE;
                    Serial.println("[BTN UP] Primer toque corto");
                }
                break;
            }

            if (now - upPressStart_ >= timing.holdThresholdMs) {
                Serial.println("[BTN UP] HOLD -> SCROLL");
                emit(PedalEvent::UP_PRESS);
                upState_ = State::SCROLLING;
            }
            break;

        case State::WAITING_DOUBLE:
            if (pressed) {
                const unsigned long elapsed = now - upFirstRelease_;

                if (elapsed <= timing.doublePressWindowMs) {
                    upPressStart_ = now;
                    upState_ = State::SECOND_PRESS;
                    Serial.println("[BTN UP] Segundo press");
                }
            } else if (now - upFirstRelease_ > timing.doublePressWindowMs) {
                upState_ = State::IDLE;
                upFirstRelease_ = 0;
            }
            break;

        case State::SECOND_PRESS:
            if (!pressed) {
                const unsigned long duration = now - upPressStart_;

                if (duration < timing.holdThresholdMs) {
                    Serial.println("[BTN UP] DOBLE TOQUE -> HOME");
                    emit(PedalEvent::HOME);
                }

                upState_ = State::IDLE;
                upPressStart_ = 0;
                upFirstRelease_ = 0;
                break;
            }

            if (now - upPressStart_ >= timing.holdThresholdMs) {
                Serial.println("[BTN UP] Segundo press HOLD -> SCROLL");
                emit(PedalEvent::UP_PRESS);
                upState_ = State::SCROLLING;
            }
            break;

        case State::SCROLLING:
            if (!pressed) {
                Serial.println("[BTN UP] RELEASE");
                emit(PedalEvent::UP_RELEASE);

                upState_ = State::IDLE;
                upPressStart_ = 0;
                upFirstRelease_ = 0;
            }
            break;
    }
}

void PedalButtons::updateDown(bool pressed, unsigned long now) {
    const auto& timing = config_->timing();

    switch (downState_) {
        case State::IDLE:
            if (pressed) {
                downState_ = State::FIRST_PRESS;
                downPressStart_ = now;
                Serial.println("[BTN DOWN] Primer press");
            }
            break;

        case State::FIRST_PRESS:
            if (!pressed) {
                const unsigned long duration = now - downPressStart_;

                if (duration >= timing.holdThresholdMs) {
                    emit(PedalEvent::DOWN_RELEASE);
                    downState_ = State::IDLE;
                } else {
                    downFirstRelease_ = now;
                    downState_ = State::WAITING_DOUBLE;
                    Serial.println("[BTN DOWN] Primer toque corto");
                }
                break;
            }

            if (now - downPressStart_ >= timing.holdThresholdMs) {
                Serial.println("[BTN DOWN] HOLD -> SCROLL");
                emit(PedalEvent::DOWN_PRESS);
                downState_ = State::SCROLLING;
            }
            break;

        case State::WAITING_DOUBLE:
            if (pressed) {
                const unsigned long elapsed = now - downFirstRelease_;

                if (elapsed <= timing.doublePressWindowMs) {
                    downPressStart_ = now;
                    downState_ = State::SECOND_PRESS;
                    Serial.println("[BTN DOWN] Segundo press");
                }
            } else if (now - downFirstRelease_ > timing.doublePressWindowMs) {
                downState_ = State::IDLE;
                downFirstRelease_ = 0;
            }
            break;

        case State::SECOND_PRESS:
            if (!pressed) {
                const unsigned long duration = now - downPressStart_;

                if (duration < timing.holdThresholdMs) {
                    Serial.println("[BTN DOWN] DOBLE TOQUE -> END");
                    emit(PedalEvent::END);
                }

                downState_ = State::IDLE;
                downPressStart_ = 0;
                downFirstRelease_ = 0;
                break;
            }

            if (now - downPressStart_ >= timing.holdThresholdMs) {
                Serial.println("[BTN DOWN] Segundo press HOLD -> SCROLL");
                emit(PedalEvent::DOWN_PRESS);
                downState_ = State::SCROLLING;
            }
            break;

        case State::SCROLLING:
            if (!pressed) {
                Serial.println("[BTN DOWN] RELEASE");
                emit(PedalEvent::DOWN_RELEASE);

                downState_ = State::IDLE;
                downPressStart_ = 0;
                downFirstRelease_ = 0;
            }
            break;
    }
}
