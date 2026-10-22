#include "PedalButtons.h"

#include "../config/PedalConfig.h"
#include "../diag/PedalDiag.h"

void PedalButtons::begin(PedalConfig &config) {
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

bool PedalButtons::bothButtonsActive() const { return bothButtonsActive_; }

void PedalButtons::update(unsigned long now) {
  bool rawUp = digitalRead(PIN_UP);
  bool rawDown = digitalRead(PIN_DOWN);

  if (rawUp != lastRawUp_) {
    lastDebounceUp_ = now;
    lastRawUp_ = rawUp;
    upEdges_.record(now);
  }

  if (now - lastDebounceUp_ >= DEBOUNCE_MS) {
    if (debouncedUp_ != rawUp) {
      debouncedUp_ = rawUp;
      logStableChange("UP", PIN_UP, debouncedUp_ == LOW, upEdges_, now);
    }
  }

  if (rawDown != lastRawDown_) {
    lastDebounceDown_ = now;
    lastRawDown_ = rawDown;
    downEdges_.record(now);
  }

  if (now - lastDebounceDown_ >= DEBOUNCE_MS) {
    if (debouncedDown_ != rawDown) {
      debouncedDown_ = rawDown;
      logStableChange("DOWN", PIN_DOWN, debouncedDown_ == LOW, downEdges_, now);
    }
  }

  const bool upPressed = debouncedUp_ == LOW;
  const bool downPressed = debouncedDown_ == LOW;

  if (checkWifiReset(upPressed, downPressed, now)) {
    return;
  }

  const State upBefore = upState_;
  const State downBefore = downState_;

  updateUp(upPressed, now);
  updateDown(downPressed, now);

  if (upState_ != upBefore) {
    upStateSince_ = now;
    PedalDiag::add(PedalDiag::Cat::BTN, "UP: %s -> %s", stateName(upBefore),
                   stateName(upState_));
  }

  if (downState_ != downBefore) {
    downStateSince_ = now;
    PedalDiag::add(PedalDiag::Cat::BTN, "DOWN: %s -> %s", stateName(downBefore),
                   stateName(downState_));
  }
}

bool PedalButtons::checkWifiReset(bool upPressed, bool downPressed,
                                  unsigned long now) {
  if (upPressed && downPressed) {
    if (!bothButtonsActive_) {
      bothButtonsActive_ = true;
      bothButtonsStart_ = now;

      PedalDiag::add(PedalDiag::Cat::BTN,
                     "UP y DOWN a la vez: se pausa la lógica de botones "
                     "(reset WiFi a los %lu ms)",
                     config_->timing().wifiResetHoldMs);

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

    PedalDiag::add(PedalDiag::Cat::BTN,
                   "UP y DOWN ya no están juntos: se reanuda");
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
  const auto &timing = config_->timing();

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
  const auto &timing = config_->timing();

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

// ─────────────────────────────────────────────
// Telemetría para el diagnóstico
// ─────────────────────────────────────────────

void PedalButtons::EdgeTracker::record(unsigned long now) {
  times[head] = now;
  head = (head + 1) % SIZE;

  if (count < SIZE) {
    ++count;
  }

  ++total;
  ++sinceStable;
}

uint16_t PedalButtons::EdgeTracker::within(unsigned long now,
                                           unsigned long windowMs) const {
  uint16_t n = 0;

  for (uint8_t i = 0; i < count; ++i) {
    if (now - times[i] <= windowMs) {
      ++n;
    }
  }

  return n;
}

const char *PedalButtons::stateName(State state) {
  switch (state) {
  case State::IDLE:
    return "IDLE";
  case State::FIRST_PRESS:
    return "FIRST_PRESS";
  case State::WAITING_DOUBLE:
    return "WAITING_DOUBLE";
  case State::SECOND_PRESS:
    return "SECOND_PRESS";
  case State::SCROLLING:
    return "SCROLLING";
  }

  return "?";
}

void PedalButtons::logStableChange(const char *name, uint8_t pin, bool pressed,
                                   EdgeTracker &edges, unsigned long now) {
  // Cambios de nivel crudos desde el último estado estable. Un pulsador
  // limpio da 1; si da varios, el contacto está rebotando.
  const uint16_t raw = edges.sinceStable;
  edges.sinceStable = 0;

  // Si se vuelve a apretar muy poco después de soltarse, puede ser un
  // contacto que se corta (en un doble toque real también pasa, pero con
  // pausas más largas).
  char gap[32] = "";

  if (pressed) {
    if (edges.hasRelease && now - edges.lastReleaseAt < CUT_HINT_MS) {
      snprintf(gap, sizeof(gap), "  [corte de %lu ms]",
               now - edges.lastReleaseAt);
    }
  } else {
    edges.lastReleaseAt = now;
    edges.hasRelease = true;
  }

  if (raw > 1) {
    PedalDiag::add(
        PedalDiag::Cat::BTN, "%s (GPIO%u) %s  [%u cambios crudos: REBOTE]%s",
        name, static_cast<unsigned>(pin), pressed ? "PRESIONADO" : "SUELTO",
        static_cast<unsigned>(raw), gap);
  } else {
    PedalDiag::add(PedalDiag::Cat::BTN, "%s (GPIO%u) %s%s", name,
                   static_cast<unsigned>(pin),
                   pressed ? "PRESIONADO" : "SUELTO", gap);
  }
}

ButtonSnapshot PedalButtons::snapshot(unsigned long now) const {
  ButtonSnapshot s;

  s.upRaw = lastRawUp_ == LOW;
  s.downRaw = lastRawDown_ == LOW;
  s.upStable = debouncedUp_ == LOW;
  s.downStable = debouncedDown_ == LOW;

  s.upState = stateName(upState_);
  s.downState = stateName(downState_);
  s.upStateMs = static_cast<uint32_t>(now - upStateSince_);
  s.downStateMs = static_cast<uint32_t>(now - downStateSince_);

  s.upEdges10s = upEdges_.within(now, 10000);
  s.downEdges10s = downEdges_.within(now, 10000);
  s.upEdgesTotal = upEdges_.total;
  s.downEdgesTotal = downEdges_.total;

  s.bothActive = bothButtonsActive_;
  s.debounceMs = static_cast<uint16_t>(DEBOUNCE_MS);

  return s;
}