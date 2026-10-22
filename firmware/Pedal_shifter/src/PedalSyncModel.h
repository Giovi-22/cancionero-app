#pragma once

#include <stddef.h>
#include <stdint.h>

/**
 * PedalSyncModel
 *
 * Mantiene la posición compartida de cada canción (en líneas lógicas) y la
 * mueve cuando el pedal está apretado. Es la "fuente de verdad" que corrige
 * la deriva entre los teléfonos.
 *
 * No depende de Arduino ni de WiFi: recibe líneas de texto de los clientes y
 * entrega líneas de texto por un ISyncSink. Por eso se puede probar en una PC.
 *
 * Protocolo (una línea por mensaje, terminada en '\n'):
 *
 *   Cliente -> ESP32
 *     HELLO <songKey> <visibleLines> <totalLines> <pos>
 *         "Abrí esta canción". visibleLines = líneas que entran en mi pantalla
 *         (peor caso). pos = mi posición actual (solo se usa si soy el primero
 *         en abrir esa canción).
 *         Se reenvía cuando cambia la pantalla o la letra; en ese caso el
 *         ESP32 solo actualiza datos y no responde.
 *     LEAVE <songKey>
 *         "Cerré esa canción".
 *
 *   ESP32 -> Cliente
 *     CFG <linesPerSec> <rampMs>
 *         Velocidad y rampa del pedal. Se envía al unirse a una canción.
 *     POS <songKey> <pos> <moving>
 *         Posición vigente. moving=1 mientras el pedal está en movimiento,
 *         moving=0 cuando quedó quieta (valor final).
 *
 * El modelo cinemático (rampa lineal hasta linesPerSec, mismo tope de dt y
 * misma velocidad mínima) es idéntico al de la app, para que la predicción
 * local y la posición del servidor coincidan.
 */

class ISyncSink {
public:
    virtual ~ISyncSink() {}

    /** Envía una línea (ya incluye '\n') al cliente del slot indicado. */
    virtual void sendToSlot(uint8_t slot, const char* line) = 0;

    /** Mensaje de depuración (opcional). */
    virtual void log(const char* message) { (void)message; }
};

class PedalSyncModel {
public:
    static const uint8_t MAX_SLOTS = 7;
    static const size_t KEY_MAX = 40;

    static constexpr float DEFAULT_LINES_PER_SEC = 2.0f;
    static const uint16_t DEFAULT_RAMP_MS = 150;

    /** Cada cuánto se reenvía POS mientras hay movimiento. */
    static const uint32_t POS_INTERVAL_MS = 250;

    /** Mismo valor que LINE_MIN_VELOCITY de la app. */
    static constexpr float MIN_VELOCITY = 0.02f;

    /** Mismo tope de dt por tick que usa la app (ms). */
    static const uint32_t MAX_DT_MS = 50;

    void begin(ISyncSink* sink, float linesPerSec, uint16_t rampMs);

    void onClientConnected(uint8_t slot);
    void onClientDisconnected(uint8_t slot);

    /** Procesa una línea recibida (sin '\n'). */
    void onClientLine(uint8_t slot, const char* line);

    /** dir: -1 = arriba (hacia el inicio), +1 = abajo. */
    void motionStart(int8_t dir, uint32_t now);
    void motionStop();

    void goHome();
    void goEnd();

    void update(uint32_t now);

    // Consultas (útiles para depuración y pruebas)
    bool isMoving() const { return active_; }
    bool getSongPos(const char* key, float& pos) const;
    uint8_t songCount() const;

    /** Datos de diagnóstico del cliente o de la canción por índice usado. */
    bool clientSong(uint8_t slot, char* key, uint16_t& visible,
                    uint16_t& total) const;
    bool songAt(uint8_t index, char* key, float& pos, uint16_t& total,
                uint8_t& clients, uint16_t& minVisible) const;

    /** Mínimo de líneas visibles entre los clientes de una canción (0 si no hay). */
    uint16_t minVisibleLines(const char* key) const;

private:
    struct ClientInfo {
        bool hasKey;
        char key[KEY_MAX];
        uint16_t visible;
        uint16_t total;
    };

    struct Song {
        bool used;
        char key[KEY_MAX];
        uint16_t total;
        float pos;
    };

    ISyncSink* sink_ = nullptr;
    float linesPerSec_ = DEFAULT_LINES_PER_SEC;
    uint16_t rampMs_ = DEFAULT_RAMP_MS;

    ClientInfo clients_[MAX_SLOTS];
    Song songs_[MAX_SLOTS];

    bool active_ = false;
    int8_t dir_ = 0;
    float vel_ = 0.0f;
    float target_ = 0.0f;
    uint32_t lastTick_ = 0;
    uint32_t lastPosSent_ = 0;

    void handleHello(uint8_t slot, char* args);
    void handleLeave(uint8_t slot, char* args);

    Song* findSong(const char* key);
    const Song* findSong(const char* key) const;
    Song* allocSong();
    void pruneSongs();

    void sendConfig(uint8_t slot);
    void sendPos(uint8_t slot, const Song& song, bool moving);
    void broadcastPositions(bool moving);

    static float clampf(float v, float lo, float hi);
};
