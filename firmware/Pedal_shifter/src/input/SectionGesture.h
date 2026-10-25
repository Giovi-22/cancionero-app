#pragma once

#include <stdint.h>

/**
 * SectionGesture
 *
 * Decide si una pulsación fue un TOQUE o un MANTENER, para el modo
 * "por secciones" del pedal. Una instancia por botón.
 *
 *   - Toque:    se suelta antes de `holdMs`.  Resultado TAP al SOLTAR.
 *   - Mantener: sigue apretado `holdMs`.      Resultado HOLD, UNA sola vez,
 *               mientras todavía está apretado. Al soltar no pasa nada más.
 *   - No hay ventana de doble toque: dos toques rápidos son dos TAP.
 *
 * Por qué el toque se resuelve al soltar y no al apretar: si saltara al
 * apretar, mantener para ir al final empezaría avanzando una sección, y al
 * apretar los dos botones (reset de WiFi) el primero dispararía un toque.
 *
 * Esta clase NO depende de Arduino: recibe el nivel ya filtrado por el
 * antirrebote y la hora en milisegundos. Así se prueba en una PC
 * (test/test_gesture.cpp). La aritmética de tiempo usa uint32_t sin signo,
 * por lo que funciona aunque millis() desborde (~49 días).
 */
class SectionGesture {
public:
    enum class Result : uint8_t { NONE, TAP, HOLD };

    enum class State : uint8_t { IDLE, PRESSED, HELD, IGNORED };

    /**
     * Se llama en cada vuelta del loop().
     *
     * @param pressed true si el botón está apretado (ya con antirrebote)
     * @param now     milisegundos (millis())
     * @param holdMs  tiempo que hay que mantener para que cuente como HOLD
     */
    Result update(bool pressed, uint32_t now, uint32_t holdMs) {
        switch (state_) {
            case State::IDLE:
                if (pressed) {
                    state_ = State::PRESSED;
                    pressedAt_ = now;
                }
                return Result::NONE;

            case State::PRESSED:
                // Se mira el tiempo primero: si el loop se demoró y el botón
                // ya se soltó pero la pulsación duró más que holdMs, fue un
                // mantener, no un toque.
                if (static_cast<uint32_t>(now - pressedAt_) >= holdMs) {
                    state_ = pressed ? State::HELD : State::IDLE;
                    return Result::HOLD;
                }

                if (!pressed) {
                    state_ = State::IDLE;
                    return Result::TAP;
                }

                return Result::NONE;

            case State::HELD:
            case State::IGNORED:
                if (!pressed) {
                    state_ = State::IDLE;
                }
                return Result::NONE;
        }

        return Result::NONE;
    }

    /**
     * Ignora lo que quede de la pulsación actual: no emite nada hasta que se
     * suelte el botón. Se usa cuando se aprietan los dos botones a la vez.
     */
    void ignoreUntilRelease() { state_ = State::IGNORED; }

    /** Vuelve a IDLE sin emitir nada (cambio de modo, reset de WiFi). */
    void reset() { state_ = State::IDLE; }

    State state() const { return state_; }

    /** Cuánto lleva apretado (solo tiene sentido en PRESSED / HELD). */
    uint32_t pressedAt() const { return pressedAt_; }

    static const char* stateName(State state) {
        switch (state) {
            case State::IDLE:    return "IDLE";
            case State::PRESSED: return "PRESSED";
            case State::HELD:    return "HELD";
            case State::IGNORED: return "IGNORED";
        }

        return "?";
    }

private:
    State state_ = State::IDLE;
    uint32_t pressedAt_ = 0;
};
