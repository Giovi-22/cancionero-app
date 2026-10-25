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
 *     MINV <songKey> <minVisible>
 *         Líneas que entran en la pantalla más chica que tiene abierta esa
 *         canción (0 = ninguna lo reportó). Se envía a todos los que la
 *         tienen abierta cada vez que alguien entra, sale o cambia de pantalla.
 *         La app lo usa para marcar hasta dónde llega esa pantalla.
 *     POS <songKey> <pos> <moving>
 *         Posición vigente. moving=1 mientras el pedal está en movimiento,
 *         moving=0 cuando quedó quieta (valor final).
 *
 * Protocolo v1 (JSON): una línea que empieza con '{' es JSON. Es el protocolo
 * de las apps nuevas; el de texto de arriba sigue funcionando sin cambios.
 *
 *   Cliente -> ESP32
 *     {"t":"hello","v":1,"song":K,"visible":N,"total":N,"pos":F,
 *      "sections":[[linea,"etiqueta"],...]}      (sections es opcional)
 *     {"t":"leave","v":1,"song":K}
 *     {"t":"resync","v":1,"song":K}              pedir el estado vigente
 *     {"t":"getcfg","v":1}                       pedir cfg sin abrir canción
 *     {"t":"setmode","v":1,"mode":"sections","overlapPercent":30}
 *         Cambia el modo del pedal desde la app. El ESP32 lo aplica, lo guarda
 *         y avisa a TODAS las apps con un cfg. mode y overlapPercent son opcionales.
 *
 *   ESP32 -> Cliente (solo a clientes v1)
 *     {"t":"cfg","v":1,"mode":"lines|sections","linesPerSec":F,"rampMs":N,
 *      "overlapPercent":N}
 *         Se envía al unirse, ante un getcfg/resync y cada vez que cambia el
 *         modo (desde la web del pedal o desde cualquier app).
 *     {"t":"sec","v":1,"song":K,"seq":N,"cause":C,"changed":B,"index":I,
 *      "count":N,"pos":F,"prev":R|null,"cur":R|null,"next":R|null}
 *         Estado de secciones. R = {"i":N,"line":N,"label":S}.
 *         cause: next prev home end join resync mode reset page.
 *
 * En modo SECTIONS el ESP32 no mueve la posición de forma continua: cada toque
 * del pedal cambia el índice de sección de las canciones abiertas.
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

    /**
     * Mensaje de depuración sobre SECCIONES (estado enviado a las apps, listas
     * adoptadas o rechazadas). Por defecto va al mismo lugar que log().
     */
    virtual void logSec(const char* message) { log(message); }

    /**
     * Una app pidió cambiar el modo (mensaje setmode). El modelo ya lo aplicó
     * y avisó a las apps; el dueño del sink tiene que GUARDARLO (configuración
     * persistente) y avisar a los botones. mode: 0 = líneas, 1 = secciones.
     */
    virtual void onModeRequested(uint8_t mode, uint8_t overlapPercent) {
        (void)mode;
        (void)overlapPercent;
    }
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

    // ── Secciones ──
    static const uint8_t MAX_SECTIONS = 32;
    static const size_t LABEL_MAX = 21;  // 20 bytes útiles + '\0'
    static const uint8_t MAX_OVERLAP_PERCENT = 60;
    static const uint8_t NO_OWNER = 0xFF;

    enum class Mode : uint8_t { LINES = 0, SECTIONS = 1 };

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

    /**
     * Modo SECTIONS: avanza (+1) o retrocede (-1) una sección en todas las
     * canciones abiertas y avisa a las apps. En modo LINES no hace nada.
     */
    void sectionStep(int8_t dir);

    /**
     * Cambia el modo y el contexto (0..60 %). Corta cualquier movimiento,
     * avisa con un cfg a todas las apps v1 y reposiciona las canciones.
     */
    void setMode(Mode mode, uint8_t overlapPercent);
    Mode mode() const { return mode_; }
    uint8_t overlapPercent() const { return overlapPercent_; }

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

    /** Protocolo del cliente: 0 = texto (viejo), 1 = JSON v1. */
    uint8_t clientProto(uint8_t slot) const;

    /**
     * Secciones de la canción número `index` entre las abiertas (el mismo
     * orden que songAt). `label` recibe la etiqueta de la sección activa
     * (vacía si todavía no empezó ninguna). Para el diagnóstico.
     */
    bool songSections(uint8_t index, int8_t& sectionIndex, uint8_t& count,
                      uint32_t& seq, uint16_t& checksum, char* label,
                      size_t labelSize) const;

    /** Estado de secciones de una canción (false si no está abierta). */
    bool sectionState(const char* key, int8_t& index, uint8_t& count,
                      uint32_t& seq, uint16_t& checksum) const;

private:
    struct SectionInfo {
        uint16_t line;
        char label[LABEL_MAX];
    };

    struct ClientInfo {
        bool hasKey;
        char key[KEY_MAX];
        uint16_t visible;
        uint16_t total;
        uint8_t proto;  // 0 = texto, 1 = JSON v1
    };

    struct Song {
        bool used;
        char key[KEY_MAX];
        uint16_t total;
        float pos;

        // Secciones (las manda el primer cliente v1 que abre la canción)
        bool sectionsKnown;
        uint8_t sectionCount;
        SectionInfo sections[MAX_SECTIONS];
        int8_t sectionIndex;      // -1 = antes de la primera
        uint16_t sectionsChecksum;
        uint8_t sectionsOwner;    // slot que mandó la lista, NO_OWNER si ninguno
        uint32_t seq;             // +1 en cada difusión de estado de secciones
    };

    // Lista de secciones ya validada, lista para adoptar
    struct SectionList {
        uint8_t count;
        SectionInfo items[MAX_SECTIONS];
        uint16_t checksum;
    };

    ISyncSink* sink_ = nullptr;
    float linesPerSec_ = DEFAULT_LINES_PER_SEC;
    uint16_t rampMs_ = DEFAULT_RAMP_MS;

    Mode mode_ = Mode::LINES;
    uint8_t overlapPercent_ = 30;

    ClientInfo clients_[MAX_SLOTS];
    Song songs_[MAX_SLOTS];

    bool active_ = false;
    int8_t dir_ = 0;
    float vel_ = 0.0f;
    float target_ = 0.0f;
    uint32_t lastTick_ = 0;
    uint32_t lastPosSent_ = 0;

    // Protocolo de texto (sin cambios)
    void handleHello(uint8_t slot, char* args);
    void handleLeave(uint8_t slot, char* args);

    // Protocolo v1 (JSON)
    void handleJson(uint8_t slot, const char* line);
    void handleHelloJson(uint8_t slot, const void* doc);
    void handleSetModeJson(uint8_t slot, const void* doc);

    // Lógica común de "abrir canción" (texto y JSON)
    void applyHello(uint8_t slot, const char* key, long visible, long total,
                    float pos, uint8_t proto, const SectionList* sections);
    void leaveSong(uint8_t slot, const char* key);
    // Devuelve true si la lista de la canción cambió.
    bool adoptSections(uint8_t slot, Song& song, const SectionList& list);

    static void initSong(Song& song);
    void logf(const char* format, ...) __attribute__((format(printf, 2, 3)));
    void logSecf(const char* format, ...) __attribute__((format(printf, 2, 3)));
    static uint16_t checksumOf(const SectionList& list);
    static void copyLabel(char* dst, const char* src);
    static float posForIndex(const Song& song, int index);
    static int indexForPos(const Song& song, float pos);

    Song* findSong(const char* key);
    const Song* findSong(const char* key) const;
    Song* allocSong();
    void pruneSongs();

    void sendConfig(uint8_t slot);
    void broadcastConfig();
    void sendPos(uint8_t slot, const Song& song, bool moving);

    // Envía a UN cliente el estado de la canción según su protocolo y el modo.
    void sendState(uint8_t slot, const Song& song, const char* cause,
                   bool changed);
    void sendSectionJson(uint8_t slot, const Song& song, const char* cause,
                         bool changed);
    // Difunde el estado de UNA canción a todos sus clientes (seq + 1).
    void broadcastSection(Song& song, const char* cause, bool changed,
                          uint8_t skipSlot = NO_OWNER);
    // Difunde el estado de todas las canciones (cambio de modo).
    void broadcastAllStates(const char* cause);
    void broadcastMinVisible(const char* key);
    void broadcastPositions(bool moving);

    static float clampf(float v, float lo, float hi);
};