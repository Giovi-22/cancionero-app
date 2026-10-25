// Prueba en PC de SectionGesture (toque / mantener del modo por secciones).
//
//   g++ -std=c++11 -Wall -Isrc test/test_gesture.cpp -o /tmp/test_gesture && /tmp/test_gesture
//
// No depende de Arduino: SectionGesture recibe el nivel ya filtrado y la hora.

#include "input/SectionGesture.h"

#include <cstdio>
#include <vector>

using R = SectionGesture::Result;

static int fails = 0;

#define CHECK(c)                                                         \
    do {                                                                 \
        if (!(c)) {                                                      \
            printf("FAIL line %d: %s\n", __LINE__, #c);                  \
            fails++;                                                     \
        }                                                                \
    } while (0)

static const uint32_t HOLD = 1500;

// Simula un botón: apretado desde `from` hasta `to` (ms), con el loop
// corriendo cada `step` ms entre `t0` y `tEnd`. Devuelve los resultados.
struct Run {
    int taps = 0;
    int holds = 0;
    uint32_t holdAt = 0;
};

static Run simulate(SectionGesture& g, uint32_t t0, uint32_t from, uint32_t to,
                    uint32_t tEnd, uint32_t step = 5) {
    Run r;
    for (uint32_t t = t0; (uint32_t)(t - t0) <= (uint32_t)(tEnd - t0); t += step) {
        // `t - from` en aritmética sin signo: sirve aunque millis() desborde
        const bool pressed = (uint32_t)(t - from) < (uint32_t)(to - from);
        const R res = g.update(pressed, t, HOLD);
        if (res == R::TAP) r.taps++;
        if (res == R::HOLD) { r.holds++; r.holdAt = t; }
    }
    return r;
}

int main() {
    // 1) Toque de 100 ms -> un TAP, al soltar
    {
        SectionGesture g;
        Run r = simulate(g, 1000, 1000, 1100, 1400);
        CHECK(r.taps == 1 && r.holds == 0);
        CHECK(g.state() == SectionGesture::State::IDLE);
    }

    // 2) El TAP sale al SOLTAR, no al apretar
    {
        SectionGesture g;
        CHECK(g.update(false, 1000, HOLD) == R::NONE);
        CHECK(g.update(true, 1010, HOLD) == R::NONE);    // apretó: todavía nada
        CHECK(g.update(true, 1060, HOLD) == R::NONE);
        CHECK(g.update(false, 1110, HOLD) == R::TAP);    // soltó: toque
    }

    // 3) Toque muy corto (60 ms, apenas sobre el antirrebote)
    {
        SectionGesture g;
        Run r = simulate(g, 1000, 1000, 1060, 1300);
        CHECK(r.taps == 1 && r.holds == 0);
    }

    // 4) Mantener 1,6 s: HOLD a los 1,5 s, una sola vez, y nada al soltar
    {
        SectionGesture g;
        Run r = simulate(g, 2000, 2000, 3600, 4500);
        CHECK(r.holds == 1);
        CHECK(r.taps == 0);
        CHECK(r.holdAt >= 3500 && r.holdAt <= 3505);     // 2000 + 1500
        CHECK(g.state() == SectionGesture::State::IDLE);
    }

    // 5) Mantener 1,2 s y soltar: es un TAP (no llegó al mantener)
    {
        SectionGesture g;
        Run r = simulate(g, 1000, 1000, 2200, 2800);
        CHECK(r.taps == 1 && r.holds == 0);
    }

    // 6) Dos toques separados 300 ms: DOS taps (no hay doble toque)
    {
        SectionGesture g;
        int taps = 0;
        for (uint32_t t = 1000; t < 2000; t += 5) {
            const bool pressed = (t >= 1000 && t < 1100) || (t >= 1400 && t < 1500);
            if (g.update(pressed, t, HOLD) == R::TAP) taps++;
        }
        CHECK(taps == 2);
    }

    // 7) ignoreUntilRelease: no emite nada mientras siga apretado,
    //    y después vuelve a funcionar
    {
        SectionGesture g;
        g.update(true, 1000, HOLD);                      // PRESSED
        g.ignoreUntilRelease();
        int emitted = 0;
        for (uint32_t t = 1005; t < 4000; t += 5) {       // sigue apretado 3 s
            if (g.update(true, t, HOLD) != R::NONE) emitted++;
        }
        CHECK(emitted == 0);                              // ni HOLD ni TAP
        CHECK(g.update(false, 4000, HOLD) == R::NONE);    // soltar: nada
        CHECK(g.state() == SectionGesture::State::IDLE);

        Run r = simulate(g, 5000, 5000, 5100, 5400);      // después, funciona
        CHECK(r.taps == 1);
    }

    // 8) ignoreUntilRelease con el botón ya suelto: el próximo toque anda igual
    {
        SectionGesture g;
        g.ignoreUntilRelease();
        CHECK(g.update(false, 1000, HOLD) == R::NONE);
        Run r = simulate(g, 2000, 2000, 2100, 2400);
        CHECK(r.taps == 1);
    }

    // 9) reset() en PRESSED: no emite nada al soltar
    {
        SectionGesture g;
        g.update(true, 1000, HOLD);
        g.reset();
        CHECK(g.update(false, 1100, HOLD) == R::NONE);
    }

    // 10) Desbordamiento de millis() durante un toque
    {
        SectionGesture g;
        const uint32_t start = 0xFFFFFFFFu - 40;          // se desborda a los 40 ms
        Run r = simulate(g, start, start, start + 100, start + 400);
        CHECK(r.taps == 1 && r.holds == 0);
    }

    // 11) Desbordamiento de millis() durante un mantener
    {
        SectionGesture g;
        const uint32_t start = 0xFFFFFFFFu - 700;
        Run r = simulate(g, start, start, start + 2000, start + 2600);
        CHECK(r.holds == 1 && r.taps == 0);
    }

    // 12) Loop demorado: el botón se soltó pero la pulsación duró más que
    //     holdMs. Cuenta como mantener, no como toque.
    {
        SectionGesture g;
        g.update(true, 1000, HOLD);
        CHECK(g.update(false, 3000, HOLD) == R::HOLD);    // 2 s después, ya suelto
        CHECK(g.state() == SectionGesture::State::IDLE);
    }

    // 13) Después de un HOLD se puede volver a tocar
    {
        SectionGesture g;
        Run a = simulate(g, 1000, 1000, 2800, 3000);
        CHECK(a.holds == 1);
        Run b = simulate(g, 4000, 4000, 4100, 4400);
        CHECK(b.taps == 1 && b.holds == 0);
    }

    // 14) holdMs distinto (configurable en la web): 800 ms
    {
        SectionGesture g;
        int holds = 0, taps = 0;
        for (uint32_t t = 1000; t < 2500; t += 5) {
            const bool pressed = t < 2000;
            const R res = g.update(pressed, t, 800);
            if (res == R::HOLD) holds++;
            if (res == R::TAP) taps++;
        }
        CHECK(holds == 1 && taps == 0);
    }

    if (fails == 0) printf("OK: todos los tests de SectionGesture pasaron\n");
    else printf("%d FALLAS\n", fails);
    return fails == 0 ? 0 : 1;
}
