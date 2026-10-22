#pragma once

#include <stddef.h>
#include <stdint.h>

/**
 * PedalDiag
 *
 * Registro de eventos en memoria (buffer circular) para la página de
 * diagnóstico. Guarda los últimos CAPACITY mensajes con su hora (ms desde el
 * arranque), una categoría y un número de secuencia creciente, así la página
 * puede pedir solo lo nuevo ("dame todo lo posterior a la secuencia N").
 *
 * Se usa desde el loop principal (botones, red, web). NO llamarlo desde
 * callbacks de otras tareas (por ejemplo los de BLE): no tiene mutex.
 */
class PedalDiag {
public:
    enum class Cat : uint8_t {
        SYS = 0,   // arranque, memoria
        BTN = 1,   // pulsadores: cambios de nivel, rebotes, estados
        EVT = 2,   // eventos que el pedal envía (UP_PRESS, HOME...)
        TCP = 3,   // clientes WiFi que se conectan / desconectan
        SYNC = 4,  // posición compartida (HELLO, movimiento)
        BLE = 5,   // Bluetooth
        WIFI = 6   // red WiFi del pedal
    };

    static const size_t CAPACITY = 100;
    static const size_t MSG_MAX = 96;

    struct Entry {
        uint32_t seq;
        uint32_t ms;
        Cat cat;
        char msg[MSG_MAX];
    };

    /** Agrega un mensaje (formato printf). */
    static void add(Cat cat, const char* fmt, ...)
        __attribute__((format(printf, 2, 3)));

    /** Variante con la hora explícita (para pruebas en PC). */
    static void addAt(uint32_t ms, Cat cat, const char* fmt, ...)
        __attribute__((format(printf, 3, 4)));

    /** Número de secuencia del último mensaje (0 si no hay ninguno). */
    static uint32_t lastSeq();

    /**
     * Copia en orden cronológico los mensajes con seq > sinceSeq.
     * Si hay más de `max`, devuelve los `max` más recientes.
     * Devuelve cuántos copió.
     */
    static size_t copySince(uint32_t sinceSeq, Entry* out, size_t max);

    static void clear();

    static const char* catName(Cat cat);

private:
    static Entry entries_[CAPACITY];
    static uint32_t seq_;
    static uint32_t firstSeq_;  // primera secuencia válida tras un clear()
};
