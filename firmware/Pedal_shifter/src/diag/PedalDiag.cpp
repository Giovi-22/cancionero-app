#include "PedalDiag.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#ifdef ARDUINO
#include <Arduino.h>
static uint32_t nowMs() { return static_cast<uint32_t>(millis()); }
#else
// Pruebas en PC: la hora se pasa explícitamente con addAt().
static uint32_t nowMs() { return 0; }
#endif

PedalDiag::Entry PedalDiag::entries_[PedalDiag::CAPACITY];
uint32_t PedalDiag::seq_ = 0;
uint32_t PedalDiag::firstSeq_ = 1;

// Si el mensaje se cortó por falta de lugar en medio de un carácter de
// varios bytes (ó, →...), se descarta el carácter incompleto.
static void trimPartialUtf8(char* s) {
    const size_t n = strlen(s);
    size_t i = n;

    while (i > 0 && (static_cast<unsigned char>(s[i - 1]) & 0xC0) == 0x80) {
        --i;
    }

    if (i == 0) return;

    const unsigned char lead = static_cast<unsigned char>(s[i - 1]);

    if (lead < 0xC0) return;  // ASCII: nada que recortar

    const size_t need = lead >= 0xF0 ? 4 : (lead >= 0xE0 ? 3 : 2);
    const size_t have = n - (i - 1);

    if (have < need) {
        s[i - 1] = '\0';
    }
}

static void vformat(char* out, size_t size, const char* fmt, va_list args) {
    vsnprintf(out, size, fmt, args);
    out[size - 1] = '\0';
    trimPartialUtf8(out);

    // Los saltos de línea romperían el formato del registro.
    for (char* p = out; *p; ++p) {
        if (*p == '\n' || *p == '\r') {
            *p = ' ';
        }
    }
}

static void store(PedalDiag::Entry& e, uint32_t seq, uint32_t ms,
                  PedalDiag::Cat cat) {
    e.seq = seq;
    e.ms = ms;
    e.cat = cat;
}

void PedalDiag::add(Cat cat, const char* fmt, ...) {
    ++seq_;
    Entry& e = entries_[seq_ % CAPACITY];
    store(e, seq_, nowMs(), cat);

    va_list args;
    va_start(args, fmt);
    vformat(e.msg, MSG_MAX, fmt, args);
    va_end(args);
}

void PedalDiag::addAt(uint32_t ms, Cat cat, const char* fmt, ...) {
    ++seq_;
    Entry& e = entries_[seq_ % CAPACITY];
    store(e, seq_, ms, cat);

    va_list args;
    va_start(args, fmt);
    vformat(e.msg, MSG_MAX, fmt, args);
    va_end(args);
}

uint32_t PedalDiag::lastSeq() {
    return seq_;
}

size_t PedalDiag::copySince(uint32_t sinceSeq, Entry* out, size_t max) {
    if (seq_ == 0 || max == 0) {
        return 0;
    }

    // Primera secuencia que todavía está en el buffer.
    uint32_t oldest = firstSeq_;
    if (seq_ >= CAPACITY && seq_ - CAPACITY + 1 > oldest) {
        oldest = seq_ - CAPACITY + 1;
    }

    uint32_t from = sinceSeq + 1;
    if (from < oldest) {
        from = oldest;
    }

    if (from > seq_) {
        return 0;
    }

    size_t count = static_cast<size_t>(seq_ - from + 1);

    if (count > max) {
        from = seq_ - static_cast<uint32_t>(max) + 1;
        count = max;
    }

    for (size_t i = 0; i < count; ++i) {
        out[i] = entries_[(from + i) % CAPACITY];
    }

    return count;
}

void PedalDiag::clear() {
    // Se conserva seq_ para que las páginas abiertas no se confundan.
    firstSeq_ = seq_ + 1;
}

const char* PedalDiag::catName(Cat cat) {
    switch (cat) {
        case Cat::SYS:  return "SYS";
        case Cat::BTN:  return "BTN";
        case Cat::EVT:  return "EVT";
        case Cat::TCP:  return "TCP";
        case Cat::SYNC: return "SYNC";
        case Cat::BLE:  return "BLE";
        case Cat::WIFI: return "WIFI";
        case Cat::SEC:  return "SEC";
    }
    return "?";
}