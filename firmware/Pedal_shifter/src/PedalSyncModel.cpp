#include "PedalSyncModel.h"

#include <ArduinoJson.h>
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace {

/**
 * Arma un JSON en un buffer fijo. Si algo no entra, `overflow` queda en true
 * y el mensaje NO debe enviarse (nunca se manda un JSON cortado).
 */
struct JsonOut {
    char* buf;
    size_t cap;
    size_t len;
    bool overflow;

    JsonOut(char* b, size_t c) : buf(b), cap(c), len(0), overflow(false) {
        if (cap > 0) buf[0] = '\0';
    }

    void put(char c) {
        if (len + 2 > cap) {
            overflow = true;
            return;
        }
        buf[len++] = c;
        buf[len] = '\0';
    }

    void raw(const char* s) {
        for (; *s != '\0'; ++s) put(*s);
    }

    void fmt(const char* format, ...) __attribute__((format(printf, 2, 3))) {
        if (overflow) return;
        va_list ap;
        va_start(ap, format);
        const int n = vsnprintf(buf + len, cap - len, format, ap);
        va_end(ap);
        if (n < 0 || static_cast<size_t>(n) >= cap - len) {
            overflow = true;
            return;
        }
        len += static_cast<size_t>(n);
    }

    /** Texto entre comillas, con escapes (comillas, barra, control). */
    void str(const char* s) {
        put('"');
        for (; *s != '\0'; ++s) {
            const unsigned char c = static_cast<unsigned char>(*s);
            if (c == '"' || c == '\\') {
                put('\\');
                put(static_cast<char>(c));
            } else if (c < 0x20) {
                fmt("\\u%04x", static_cast<unsigned>(c));
            } else {
                put(static_cast<char>(c));
            }
        }
        put('"');
    }
};

/** Una clave de canción segura: ASCII imprimible, sin espacios, comillas ni barras. */
bool validSongKey(const char* key, size_t maxLen) {
    if (key == nullptr) return false;
    const size_t n = strlen(key);
    if (n == 0 || n >= maxLen) return false;
    for (size_t i = 0; i < n; ++i) {
        const unsigned char c = static_cast<unsigned char>(key[i]);
        if (c <= ' ' || c >= 0x7f || c == '"' || c == '\\') return false;
    }
    return true;
}

/** Devuelve el próximo token separado por espacios (modifica el buffer). */
char* nextToken(char*& p) {
    while (*p == ' ') {
        ++p;
    }

    if (*p == '\0') {
        return nullptr;
    }

    char* start = p;

    while (*p != '\0' && *p != ' ') {
        ++p;
    }

    if (*p == ' ') {
        *p = '\0';
        ++p;
    }

    return start;
}

bool parseInt(const char* text, long minValue, long maxValue, long& out) {
    char* end = nullptr;
    const long value = strtol(text, &end, 10);

    if (end == text || *end != '\0') {
        return false;
    }

    if (value < minValue || value > maxValue) {
        return false;
    }

    out = value;
    return true;
}

bool parseFloat(const char* text, float& out) {
    char* end = nullptr;
    const double value = strtod(text, &end);

    if (end == text || *end != '\0') {
        return false;
    }

    if (value != value || value > 1.0e9 || value < -1.0e9) {
        return false;
    }

    out = static_cast<float>(value);
    return true;
}

}  // namespace

float PedalSyncModel::clampf(float v, float lo, float hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
}

void PedalSyncModel::begin(ISyncSink* sink, float linesPerSec, uint16_t rampMs) {
    sink_ = sink;
    linesPerSec_ = linesPerSec;
    rampMs_ = rampMs == 0 ? 1 : rampMs;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        clients_[i].hasKey = false;
        clients_[i].key[0] = '\0';
        clients_[i].visible = 0;
        clients_[i].total = 0;
        clients_[i].proto = 0;

        songs_[i].used = false;
        songs_[i].key[0] = '\0';
        songs_[i].total = 0;
        songs_[i].pos = 0.0f;
        initSong(songs_[i]);
    }

    mode_ = Mode::LINES;
    overlapPercent_ = 30;

    active_ = false;
    dir_ = 0;
    vel_ = 0.0f;
    target_ = 0.0f;
}

void PedalSyncModel::onClientConnected(uint8_t slot) {
    if (slot >= MAX_SLOTS) return;

    clients_[slot].hasKey = false;
    clients_[slot].key[0] = '\0';
    clients_[slot].visible = 0;
    clients_[slot].total = 0;
    clients_[slot].proto = 0;

    // Si este cliente era el dueño de la lista de secciones de una canción,
    // la canción queda sin dueño (la próxima lista que llegue se adopta).
    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (songs_[i].used && songs_[i].sectionsOwner == slot) {
            songs_[i].sectionsOwner = NO_OWNER;
        }
    }

    pruneSongs();
}

void PedalSyncModel::onClientDisconnected(uint8_t slot) {
    if (slot >= MAX_SLOTS) return;

    char previousKey[KEY_MAX];
    const bool hadKey = clients_[slot].hasKey;

    if (hadKey) {
        memcpy(previousKey, clients_[slot].key, KEY_MAX);
    }

    onClientConnected(slot);

    // Los que siguen con esa canción abierta pueden tener ahora otra pantalla mínima.
    if (hadKey) {
        broadcastMinVisible(previousKey);
    }
}

void PedalSyncModel::onClientLine(uint8_t slot, const char* line) {
    if (slot >= MAX_SLOTS || line == nullptr) return;

    // Protocolo v1: una línea que empieza con '{' es JSON.
    if (line[0] == '{') {
        handleJson(slot, line);
        return;
    }

    // Protocolo de texto (sin cambios).
    char buffer[128];
    const size_t length = strlen(line);

    if (length == 0 || length >= sizeof(buffer)) return;

    memcpy(buffer, line, length + 1);

    char* args = nullptr;
    char* space = strchr(buffer, ' ');

    if (space != nullptr) {
        *space = '\0';
        args = space + 1;
    }

    if (args == nullptr) return;

    if (strcmp(buffer, "HELLO") == 0) {
        handleHello(slot, args);
    } else if (strcmp(buffer, "LEAVE") == 0) {
        handleLeave(slot, args);
    }
}

void PedalSyncModel::handleHello(uint8_t slot, char* args) {
    char* cursor = args;

    char* key = nextToken(cursor);
    char* visibleText = nextToken(cursor);
    char* totalText = nextToken(cursor);
    char* posText = nextToken(cursor);

    if (!key || !visibleText || !totalText || !posText) return;

    const size_t keyLength = strlen(key);
    if (keyLength == 0 || keyLength >= KEY_MAX) return;

    long visible = 0;
    long total = 0;
    float pos = 0.0f;

    if (!parseInt(visibleText, 0, 65535, visible)) return;
    if (!parseInt(totalText, 1, 65535, total)) return;
    if (!parseFloat(posText, pos)) return;

    applyHello(slot, key, visible, total, pos, 0, nullptr);
}

void PedalSyncModel::handleLeave(uint8_t slot, char* args) {
    char* cursor = args;
    char* key = nextToken(cursor);

    if (!key) return;

    leaveSong(slot, key);
}

/**
 * "Abrir canción": lo comparten el HELLO de texto y el hello JSON.
 * `sections` es nullptr si el cliente no mandó lista de secciones.
 */
void PedalSyncModel::applyHello(uint8_t slot, const char* key, long visible,
                                long total, float pos, uint8_t proto,
                                const SectionList* sections) {
    const size_t keyLength = strlen(key);

    ClientInfo& client = clients_[slot];

    const bool join = !(client.hasKey && strcmp(client.key, key) == 0);

    char previousKey[KEY_MAX];
    const bool changedSong = join && client.hasKey;

    if (changedSong) {
        memcpy(previousKey, client.key, KEY_MAX);

        // Dejar la canción anterior también deja de ser dueño de su lista.
        Song* previous = findSong(previousKey);

        if (previous != nullptr && previous->sectionsOwner == slot) {
            previous->sectionsOwner = NO_OWNER;
        }
    }

    client.proto = proto;
    client.hasKey = true;
    memcpy(client.key, key, keyLength + 1);
    client.visible = static_cast<uint16_t>(visible);
    client.total = static_cast<uint16_t>(total);

    // Si el cliente venía de otra canción, esa pudo quedar sin nadie.
    pruneSongs();

    Song* song = findSong(key);
    bool created = false;

    if (song == nullptr) {
        song = allocSong();

        if (song == nullptr) return;  // No debería pasar: hay lugar para MAX_SLOTS.

        initSong(*song);
        song->used = true;
        memcpy(song->key, key, keyLength + 1);
        song->total = static_cast<uint16_t>(total);
        song->pos = clampf(pos, 0.0f, static_cast<float>(total));
        created = true;
    } else {
        song->total = static_cast<uint16_t>(total);
        song->pos = clampf(song->pos, 0.0f, static_cast<float>(total));
    }

    bool sectionsChanged = false;

    if (proto == 1 && sections != nullptr) {
        sectionsChanged = adoptSections(slot, *song, *sections);
    }

    if (sink_ != nullptr) {
        char message[120];

        snprintf(
            message,
            sizeof(message),
            "[SYNC] %s slot=%u key=%s visible=%ld total=%ld",
            join ? "HELLO" : "UPDATE",
            static_cast<unsigned>(slot),
            key,
            visible,
            total
        );

        sink_->log(message);
    }

    if (join) {
        sendConfig(slot);
        sendState(slot, *song, "join", false);
    }

    // La lista de secciones cambió: los demás que ya tenían la canción abierta
    // se enteran. Quien recién se une ya recibió el estado de arriba.
    if (sectionsChanged && !created) {
        broadcastSection(*song, "reset", true, join ? slot : NO_OWNER);
    }

    // Si venía de otra canción, a los que se quedaron ahí les cambió el mínimo.
    if (changedSong) {
        broadcastMinVisible(previousKey);
    }

    broadcastMinVisible(key);
}

void PedalSyncModel::leaveSong(uint8_t slot, const char* key) {
    ClientInfo& client = clients_[slot];

    if (client.hasKey && strcmp(client.key, key) == 0) {
        Song* song = findSong(key);

        if (song != nullptr && song->sectionsOwner == slot) {
            song->sectionsOwner = NO_OWNER;
        }

        client.hasKey = false;
        client.key[0] = '\0';
        client.visible = 0;
        client.total = 0;

        pruneSongs();
        broadcastMinVisible(key);
    }
}

// ─────────────────────────────────────────────
// Protocolo v1 (JSON)
// ─────────────────────────────────────────────

void PedalSyncModel::logf(const char* format, ...) {
    if (sink_ == nullptr) return;

    char message[120];

    va_list ap;
    va_start(ap, format);
    vsnprintf(message, sizeof(message), format, ap);
    va_end(ap);

    sink_->log(message);
}

void PedalSyncModel::logSecf(const char* format, ...) {
    if (sink_ == nullptr) return;

    char message[120];

    va_list ap;
    va_start(ap, format);
    vsnprintf(message, sizeof(message), format, ap);
    va_end(ap);

    sink_->logSec(message);
}

void PedalSyncModel::handleJson(uint8_t slot, const char* line) {
    JsonDocument doc;
    const DeserializationError error = deserializeJson(doc, line);

    if (error) {
        logf("[SYNC] slot %u: JSON inválido (%s)",
             static_cast<unsigned>(slot), error.c_str());
        return;
    }

    if (!doc.is<JsonObject>()) {
        logf("[SYNC] slot %u: el JSON no es un objeto",
             static_cast<unsigned>(slot));
        return;
    }

    const int version = doc["v"] | 0;

    if (version != 1) {
        logf("[SYNC] slot %u: versión de protocolo no soportada (%d)",
             static_cast<unsigned>(slot), version);
        return;
    }

    const char* type = doc["t"] | "";

    // Cualquier mensaje v1 válido marca al cliente como "habla JSON".
    clients_[slot].proto = 1;

    if (strcmp(type, "hello") == 0) {
        handleHelloJson(slot, &doc);
    } else if (strcmp(type, "leave") == 0) {
        const char* key = doc["song"] | "";

        if (validSongKey(key, KEY_MAX)) {
            leaveSong(slot, key);
        }
    } else if (strcmp(type, "resync") == 0) {
        const char* key = doc["song"] | "";

        sendConfig(slot);

        const ClientInfo& client = clients_[slot];

        if (validSongKey(key, KEY_MAX) && client.hasKey &&
            strcmp(client.key, key) == 0) {
            const Song* song = findSong(key);

            if (song != nullptr) {
                logSecf("[SEC] resync slot=%u key=%s",
                        static_cast<unsigned>(slot), key);
                sendState(slot, *song, "resync", false);
            }
        }
    } else if (strcmp(type, "getcfg") == 0) {
        sendConfig(slot);
    } else if (strcmp(type, "setmode") == 0) {
        handleSetModeJson(slot, &doc);
    } else {
        logf("[SYNC] slot %u: tipo de mensaje desconocido", 
             static_cast<unsigned>(slot));
    }
}

void PedalSyncModel::handleHelloJson(uint8_t slot, const void* docPtr) {
    const JsonDocument& doc = *static_cast<const JsonDocument*>(docPtr);

    const char* key = doc["song"] | "";

    if (!validSongKey(key, KEY_MAX)) {
        logf("[SYNC] slot %u: hello con clave de canción inválida",
             static_cast<unsigned>(slot));
        return;
    }

    const long visible = doc["visible"] | -1L;
    const long total = doc["total"] | 0L;
    const float pos = doc["pos"] | 0.0f;

    if (visible < 0 || visible > 65535 || total < 1 || total > 65535 ||
        pos != pos) {
        logf("[SYNC] slot %u: hello con valores fuera de rango",
             static_cast<unsigned>(slot));
        return;
    }

    // Lista de secciones (opcional): [[linea,"etiqueta"],...]
    SectionList list;
    list.count = 0;
    list.checksum = 0;

    bool haveList = false;
    const JsonArrayConst array = doc["sections"].as<JsonArrayConst>();

    if (!array.isNull()) {
        bool valid = true;
        bool truncated = false;
        long previousLine = -1;

        for (JsonVariantConst item : array) {
            const JsonArrayConst pair = item.as<JsonArrayConst>();

            if (pair.isNull() || pair.size() < 2) {
                valid = false;
                break;
            }

            const long line = pair[0] | -1L;
            const char* label = pair[1] | "";

            // Las líneas tienen que ser válidas y estrictamente crecientes.
            if (line < 0 || line >= total || line <= previousLine) {
                valid = false;
                break;
            }

            if (list.count >= MAX_SECTIONS) {
                truncated = true;
                break;
            }

            list.items[list.count].line = static_cast<uint16_t>(line);
            copyLabel(list.items[list.count].label, label);
            ++list.count;
            previousLine = line;
        }

        if (!valid) {
            logSecf("[SEC] slot %u: lista de secciones inválida, se ignora",
                    static_cast<unsigned>(slot));
        } else {
            if (truncated) {
                logSecf("[SEC] slot %u: más de %u secciones, se usan las primeras",
                        static_cast<unsigned>(slot),
                        static_cast<unsigned>(MAX_SECTIONS));
            }

            list.checksum = checksumOf(list);
            haveList = true;
        }
    }

    applyHello(slot, key, visible, total, pos, 1, haveList ? &list : nullptr);
}

void PedalSyncModel::handleSetModeJson(uint8_t slot, const void* docPtr) {
    const JsonDocument& doc = *static_cast<const JsonDocument*>(docPtr);

    const char* modeText = doc["mode"] | "";

    Mode newMode = mode_;

    if (strcmp(modeText, "lines") == 0) {
        newMode = Mode::LINES;
    } else if (strcmp(modeText, "sections") == 0) {
        newMode = Mode::SECTIONS;
    } else if (modeText[0] != '\0') {
        logf("[SYNC] slot %u: setmode con modo desconocido",
             static_cast<unsigned>(slot));
        return;
    }

    long overlap = doc["overlapPercent"] | static_cast<long>(overlapPercent_);

    if (overlap < 0) overlap = 0;
    if (overlap > MAX_OVERLAP_PERCENT) overlap = MAX_OVERLAP_PERCENT;

    const bool changed =
        newMode != mode_ || static_cast<uint8_t>(overlap) != overlapPercent_;

    logf("[SYNC] setmode slot=%u modo=%s contexto=%ld%% %s",
         static_cast<unsigned>(slot),
         newMode == Mode::SECTIONS ? "sections" : "lines", overlap,
         changed ? "" : "(sin cambios)");

    // Siempre se responde con un cfg (también a quien lo pidió sin cambios).
    setMode(newMode, static_cast<uint8_t>(overlap));

    // El dueño del sink guarda el modo y avisa a los botones.
    if (changed && sink_ != nullptr) {
        sink_->onModeRequested(static_cast<uint8_t>(newMode),
                               static_cast<uint8_t>(overlap));
    }
}

// ─────────────────────────────────────────────
// Secciones
// ─────────────────────────────────────────────

void PedalSyncModel::initSong(Song& song) {
    song.sectionsKnown = false;
    song.sectionCount = 0;
    song.sectionIndex = -1;
    song.sectionsChecksum = 0;
    song.sectionsOwner = NO_OWNER;
    song.seq = 0;
}

/** FNV-1a de 32 bits sobre cantidad, líneas y etiquetas, plegado a 16. */
uint16_t PedalSyncModel::checksumOf(const SectionList& list) {
    uint32_t hash = 2166136261u;

    auto mix = [&hash](uint8_t byte) {
        hash ^= byte;
        hash *= 16777619u;
    };

    mix(list.count);

    for (uint8_t i = 0; i < list.count; ++i) {
        mix(static_cast<uint8_t>(list.items[i].line & 0xFF));
        mix(static_cast<uint8_t>(list.items[i].line >> 8));

        for (const char* p = list.items[i].label; *p != '\0'; ++p) {
            mix(static_cast<uint8_t>(*p));
        }

        mix(0);
    }

    return static_cast<uint16_t>((hash >> 16) ^ (hash & 0xFFFF));
}

/** Copia la etiqueta sin partir un carácter UTF-8 por la mitad. */
void PedalSyncModel::copyLabel(char* dst, const char* src) {
    size_t n = strlen(src);

    if (n > LABEL_MAX - 1) {
        n = LABEL_MAX - 1;

        // src[n] es el primer byte que NO entra: si es de continuación, el
        // carácter anterior quedaría cortado, así que se retrocede.
        while (n > 0 && (static_cast<unsigned char>(src[n]) & 0xC0) == 0x80) {
            --n;
        }
    }

    memcpy(dst, src, n);
    dst[n] = '\0';
}

float PedalSyncModel::posForIndex(const Song& song, int index) {
    if (index < 0 || index >= static_cast<int>(song.sectionCount)) {
        return 0.0f;
    }

    return static_cast<float>(song.sections[index].line);
}

/** Última sección que ya empezó en `pos` (-1 si todavía no empezó ninguna). */
int PedalSyncModel::indexForPos(const Song& song, float pos) {
    int index = -1;

    for (uint8_t i = 0; i < song.sectionCount; ++i) {
        if (static_cast<float>(song.sections[i].line) <= pos + 0.001f) {
            index = i;
        } else {
            break;
        }
    }

    return index;
}

bool PedalSyncModel::adoptSections(uint8_t slot, Song& song,
                                   const SectionList& list) {
    const bool same = song.sectionsKnown &&
                      song.sectionCount == list.count &&
                      song.sectionsChecksum == list.checksum;

    if (same) {
        if (song.sectionsOwner == NO_OWNER) {
            song.sectionsOwner = slot;
        }

        return false;
    }

    // Otro cliente ya es el dueño de una lista distinta: se queda la primera.
    if (song.sectionsKnown && song.sectionsOwner != NO_OWNER &&
        song.sectionsOwner != slot) {
        logSecf("[SEC] lista de secciones distinta de slot=%u (cs=%04x) "
                "rechazada; vale la de slot=%u (cs=%04x)",
                static_cast<unsigned>(slot), static_cast<unsigned>(list.checksum),
                static_cast<unsigned>(song.sectionsOwner),
                static_cast<unsigned>(song.sectionsChecksum));
        return false;
    }

    song.sectionsKnown = true;
    song.sectionCount = list.count;

    for (uint8_t i = 0; i < list.count; ++i) {
        song.sections[i] = list.items[i];
    }

    song.sectionsChecksum = list.checksum;
    song.sectionsOwner = slot;

    // La posición manda: el índice se deriva de dónde está la canción.
    song.sectionIndex = static_cast<int8_t>(indexForPos(song, song.pos));

    logSecf("[SEC] secciones adoptadas: key=%.12s n=%u cs=%04x dueño=slot %u",
            song.key, static_cast<unsigned>(list.count),
            static_cast<unsigned>(list.checksum), static_cast<unsigned>(slot));

    return true;
}

uint8_t PedalSyncModel::clientProto(uint8_t slot) const {
    return slot < MAX_SLOTS ? clients_[slot].proto : 0;
}

bool PedalSyncModel::songSections(uint8_t index, int8_t& sectionIndex,
                                  uint8_t& count, uint32_t& seq,
                                  uint16_t& checksum, char* label,
                                  size_t labelSize) const {
    uint8_t usedIndex = 0;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        const Song& song = songs_[i];

        if (!song.used) continue;
        if (usedIndex++ != index) continue;

        sectionIndex = song.sectionIndex;
        count = song.sectionCount;
        seq = song.seq;
        checksum = song.sectionsChecksum;

        if (label != nullptr && labelSize > 0) {
            label[0] = '\0';

            if (song.sectionIndex >= 0 && song.sectionIndex < song.sectionCount) {
                strncpy(label, song.sections[song.sectionIndex].label,
                        labelSize - 1);
                label[labelSize - 1] = '\0';
            }
        }

        return true;
    }

    return false;
}

bool PedalSyncModel::sectionState(const char* key, int8_t& index,
                                  uint8_t& count, uint32_t& seq,
                                  uint16_t& checksum) const {
    const Song* song = findSong(key);

    if (song == nullptr) return false;

    index = song->sectionIndex;
    count = song->sectionCount;
    seq = song->seq;
    checksum = song->sectionsChecksum;
    return true;
}

PedalSyncModel::Song* PedalSyncModel::findSong(const char* key) {
    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (songs_[i].used && strcmp(songs_[i].key, key) == 0) {
            return &songs_[i];
        }
    }

    return nullptr;
}

const PedalSyncModel::Song* PedalSyncModel::findSong(const char* key) const {
    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (songs_[i].used && strcmp(songs_[i].key, key) == 0) {
            return &songs_[i];
        }
    }

    return nullptr;
}

PedalSyncModel::Song* PedalSyncModel::allocSong() {
    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (!songs_[i].used) {
            return &songs_[i];
        }
    }

    return nullptr;
}

void PedalSyncModel::pruneSongs() {
    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (!songs_[i].used) continue;

        bool referenced = false;

        for (uint8_t c = 0; c < MAX_SLOTS; ++c) {
            if (clients_[c].hasKey &&
                strcmp(clients_[c].key, songs_[i].key) == 0) {
                referenced = true;
                break;
            }
        }

        if (!referenced) {
            songs_[i].used = false;
        }
    }
}

void PedalSyncModel::sendConfig(uint8_t slot) {
    if (sink_ == nullptr || slot >= MAX_SLOTS) return;

    // Clientes v1: cfg en JSON, con el modo del pedal.
    if (clients_[slot].proto == 1) {
        char json[176];

        snprintf(
            json,
            sizeof(json),
            "{\"t\":\"cfg\",\"v\":1,\"mode\":\"%s\",\"linesPerSec\":%.2f,"
            "\"rampMs\":%u,\"overlapPercent\":%u}\n",
            mode_ == Mode::SECTIONS ? "sections" : "lines",
            static_cast<double>(linesPerSec_),
            static_cast<unsigned>(rampMs_),
            static_cast<unsigned>(overlapPercent_)
        );

        sink_->sendToSlot(slot, json);
        return;
    }

    // Clientes de texto: el CFG de siempre.
    char line[48];

    snprintf(
        line,
        sizeof(line),
        "CFG %.2f %u\n",
        static_cast<double>(linesPerSec_),
        static_cast<unsigned>(rampMs_)
    );

    sink_->sendToSlot(slot, line);
}

void PedalSyncModel::sendPos(uint8_t slot, const Song& song, bool moving) {
    if (sink_ == nullptr) return;

    char line[96];

    snprintf(
        line,
        sizeof(line),
        "POS %s %.2f %d\n",
        song.key,
        static_cast<double>(song.pos),
        moving ? 1 : 0
    );

    sink_->sendToSlot(slot, line);
}

void PedalSyncModel::broadcastConfig() {
    for (uint8_t c = 0; c < MAX_SLOTS; ++c) {
        if (clients_[c].proto == 1) {
            sendConfig(c);
        }
    }
}

/**
 * Estado de una canción para UN cliente:
 *  - cliente v1 en modo secciones -> mensaje JSON `sec`
 *  - cualquier otro caso          -> POS de texto, como siempre
 */
void PedalSyncModel::sendState(uint8_t slot, const Song& song,
                               const char* cause, bool changed) {
    if (slot >= MAX_SLOTS) return;

    if (clients_[slot].proto == 1 && mode_ == Mode::SECTIONS) {
        sendSectionJson(slot, song, cause, changed);
    } else {
        sendPos(slot, song, active_);
    }
}

namespace {

/** ,"nombre":{"i":N,"line":N,"label":"..."}  o  ,"nombre":null */
void appendRef(JsonOut& out, const char* name, int index, int count,
               const uint16_t* lines, const char* const* labels,
               bool withLabels) {
    out.fmt(",\"%s\":", name);

    if (index < 0 || index >= count) {
        out.raw("null");
        return;
    }

    out.fmt("{\"i\":%d,\"line\":%u", index,
            static_cast<unsigned>(lines[index]));

    if (withLabels) {
        out.raw(",\"label\":");
        out.str(labels[index]);
    }

    out.raw("}");
}

}  // namespace

void PedalSyncModel::sendSectionJson(uint8_t slot, const Song& song,
                                     const char* cause, bool changed) {
    if (sink_ == nullptr) return;

    const int count = song.sectionCount;
    const int index = song.sectionIndex;

    uint16_t lines[MAX_SECTIONS];
    const char* labels[MAX_SECTIONS];

    for (int i = 0; i < count; ++i) {
        lines[i] = song.sections[i].line;
        labels[i] = song.sections[i].label;
    }

    char buffer[640];

    // Primer intento con etiquetas; si no entra, sin etiquetas. Nunca se manda
    // un JSON cortado.
    for (int attempt = 0; attempt < 2; ++attempt) {
        const bool withLabels = attempt == 0;

        JsonOut out(buffer, sizeof(buffer));

        out.raw("{\"t\":\"sec\",\"v\":1,\"song\":");
        out.str(song.key);
        out.fmt(",\"seq\":%lu,\"cause\":", static_cast<unsigned long>(song.seq));
        out.str(cause);
        out.fmt(",\"changed\":%s,\"index\":%d,\"count\":%d,\"pos\":%.2f",
                changed ? "true" : "false", index, count,
                static_cast<double>(song.pos));

        appendRef(out, "prev", index - 1, count, lines, labels, withLabels);
        appendRef(out, "cur", index, count, lines, labels, withLabels);
        appendRef(out, "next", index + 1, count, lines, labels, withLabels);

        out.raw("}\n");

        if (!out.overflow) {
            sink_->sendToSlot(slot, buffer);
            return;
        }
    }

    logSecf("[SEC] sec demasiado largo, no se envía (key=%.12s)", song.key);
}

void PedalSyncModel::broadcastSection(Song& song, const char* cause,
                                      bool changed, uint8_t skipSlot) {
    ++song.seq;

    unsigned delivered = 0;

    for (uint8_t c = 0; c < MAX_SLOTS; ++c) {
        if (c == skipSlot) continue;

        if (clients_[c].hasKey && strcmp(clients_[c].key, song.key) == 0) {
            sendState(c, song, cause, changed);
            ++delivered;
        }
    }

    logSecf("[SEC] %.8s #%lu %s %d/%u -> %u cliente(s)", song.key,
            static_cast<unsigned long>(song.seq), cause,
            static_cast<int>(song.sectionIndex) + 1,
            static_cast<unsigned>(song.sectionCount), delivered);
}

void PedalSyncModel::broadcastAllStates(const char* cause) {
    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (songs_[i].used) {
            broadcastSection(songs_[i], cause, true);
        }
    }
}

void PedalSyncModel::broadcastMinVisible(const char* key) {
    if (sink_ == nullptr || key == nullptr) return;

    char line[96];

    snprintf(
        line,
        sizeof(line),
        "MINV %s %u\n",
        key,
        static_cast<unsigned>(minVisibleLines(key))
    );

    for (uint8_t c = 0; c < MAX_SLOTS; ++c) {
        if (clients_[c].hasKey && strcmp(clients_[c].key, key) == 0) {
            sink_->sendToSlot(c, line);
        }
    }
}

void PedalSyncModel::broadcastPositions(bool moving) {
    for (uint8_t s = 0; s < MAX_SLOTS; ++s) {
        if (!songs_[s].used) continue;

        for (uint8_t c = 0; c < MAX_SLOTS; ++c) {
            if (clients_[c].hasKey &&
                strcmp(clients_[c].key, songs_[s].key) == 0) {
                sendPos(c, songs_[s], moving);
            }
        }
    }
}

void PedalSyncModel::motionStart(int8_t dir, uint32_t now) {
    if (dir == 0) return;

    // En modo secciones el ESP32 no mueve la posición de forma continua.
    if (mode_ != Mode::LINES) return;

    dir_ = dir;
    target_ = linesPerSec_;

    if (!active_) {
        active_ = true;
        vel_ = 0.0f;
        lastTick_ = now;
        lastPosSent_ = now;
    }
}

void PedalSyncModel::motionStop() {
    target_ = 0.0f;
}

void PedalSyncModel::goHome() {
    active_ = false;
    dir_ = 0;
    vel_ = 0.0f;
    target_ = 0.0f;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (songs_[i].used) {
            songs_[i].pos = 0.0f;
            songs_[i].sectionIndex = -1;
        }
    }

    if (mode_ == Mode::SECTIONS) {
        for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
            if (songs_[i].used) {
                broadcastSection(songs_[i], "home", true);
            }
        }
        return;
    }

    broadcastPositions(false);
}

void PedalSyncModel::goEnd() {
    active_ = false;
    dir_ = 0;
    vel_ = 0.0f;
    target_ = 0.0f;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (songs_[i].used) {
            songs_[i].pos = static_cast<float>(songs_[i].total);
            songs_[i].sectionIndex = songs_[i].sectionCount > 0
                ? static_cast<int8_t>(songs_[i].sectionCount - 1)
                : static_cast<int8_t>(-1);
        }
    }

    if (mode_ == Mode::SECTIONS) {
        for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
            if (songs_[i].used) {
                broadcastSection(songs_[i], "end", true);
            }
        }
        return;
    }

    broadcastPositions(false);
}

/**
 * Modo secciones: un toque del pedal.
 * Todas las canciones abiertas avanzan (o retroceden) una sección, cada una
 * dentro de su propio rango. Una canción sin secciones avanza por páginas.
 */
void PedalSyncModel::sectionStep(int8_t dir) {
    if (mode_ != Mode::SECTIONS || dir == 0) return;

    const int step = dir > 0 ? 1 : -1;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        Song& song = songs_[i];

        if (!song.used) continue;

        if (song.sectionCount > 0) {
            int next = static_cast<int>(song.sectionIndex) + step;

            if (next < -1) next = -1;
            if (next > static_cast<int>(song.sectionCount) - 1) {
                next = static_cast<int>(song.sectionCount) - 1;
            }

            const bool changed = next != song.sectionIndex;

            song.sectionIndex = static_cast<int8_t>(next);
            song.pos = posForIndex(song, next);

            broadcastSection(song, step > 0 ? "next" : "prev", changed);
        } else {
            // Sin etiquetas: se avanza por páginas, dejando el contexto
            // configurado de la página anterior.
            uint16_t visible = minVisibleLines(song.key);

            if (visible == 0) visible = 8;

            long keep = (static_cast<long>(visible) * overlapPercent_ + 50) / 100;
            long page = static_cast<long>(visible) - keep;

            if (page < 1) page = 1;

            const float before = song.pos;

            song.pos = clampf(
                song.pos + static_cast<float>(step * page),
                0.0f,
                static_cast<float>(song.total)
            );

            broadcastSection(song, "page", song.pos != before);
        }
    }
}

void PedalSyncModel::setMode(Mode mode, uint8_t overlapPercent) {
    if (overlapPercent > MAX_OVERLAP_PERCENT) {
        overlapPercent = MAX_OVERLAP_PERCENT;
    }

    const bool modeChanged = mode != mode_;

    mode_ = mode;
    overlapPercent_ = overlapPercent;

    if (modeChanged) {
        // Se corta cualquier movimiento continuo.
        active_ = false;
        dir_ = 0;
        vel_ = 0.0f;
        target_ = 0.0f;

        // Pasando a secciones, el índice sale de dónde está cada canción.
        // (Pasando a líneas, pos ya está al día: la actualiza cada sección.)
        if (mode_ == Mode::SECTIONS) {
            for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
                if (songs_[i].used) {
                    songs_[i].sectionIndex = static_cast<int8_t>(
                        indexForPos(songs_[i], songs_[i].pos));
                }
            }
        }
    }

    logf("[SYNC] modo=%s contexto=%u%%",
         mode_ == Mode::SECTIONS ? "secciones" : "lineas",
         static_cast<unsigned>(overlapPercent_));

    broadcastConfig();

    if (modeChanged) {
        broadcastAllStates("mode");
    }
}

void PedalSyncModel::update(uint32_t now) {
    if (!active_) return;

    uint32_t dtMs = now - lastTick_;

    if (dtMs == 0) return;
    if (dtMs > MAX_DT_MS) dtMs = MAX_DT_MS;

    lastTick_ = now;

    const float rate =
        (linesPerSec_ / static_cast<float>(rampMs_)) * static_cast<float>(dtMs);

    if (target_ > vel_) {
        vel_ = (vel_ + rate > target_) ? target_ : vel_ + rate;
    } else {
        vel_ = (vel_ - rate < target_) ? target_ : vel_ - rate;
    }

    // Se considera detenido solo si ya no se pide movimiento (pedal soltado)
    // y la velocidad llegó a cero. Al acelerar desde cero la velocidad de los
    // primeros ticks es menor a MIN_VELOCITY: eso NO es "frenado completo".
    const bool keepMoving =
        dir_ != 0 && (vel_ > MIN_VELOCITY || target_ > 0.0f);

    if (keepMoving) {
        const float delta =
            static_cast<float>(dir_) * vel_ * (static_cast<float>(dtMs) / 1000.0f);

        for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
            if (songs_[i].used) {
                songs_[i].pos = clampf(
                    songs_[i].pos + delta,
                    0.0f,
                    static_cast<float>(songs_[i].total)
                );
            }
        }

        if (now - lastPosSent_ >= POS_INTERVAL_MS) {
            lastPosSent_ = now;
            broadcastPositions(true);
        }
    } else {
        active_ = false;
        dir_ = 0;
        vel_ = 0.0f;
        target_ = 0.0f;

        broadcastPositions(false);
    }
}

bool PedalSyncModel::getSongPos(const char* key, float& pos) const {
    const Song* song = findSong(key);

    if (song == nullptr) return false;

    pos = song->pos;
    return true;
}

uint8_t PedalSyncModel::songCount() const {
    uint8_t count = 0;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        if (songs_[i].used) ++count;
    }

    return count;
}

bool PedalSyncModel::clientSong(uint8_t slot, char* key, uint16_t& visible,
                                uint16_t& total) const {
    if (slot >= MAX_SLOTS || !clients_[slot].hasKey) return false;

    const ClientInfo& client = clients_[slot];
    if (key != nullptr) {
        strncpy(key, client.key, KEY_MAX - 1);
        key[KEY_MAX - 1] = '\0';
    }
    visible = client.visible;
    total = client.total;
    return true;
}

bool PedalSyncModel::songAt(uint8_t index, char* key, float& pos,
                            uint16_t& total, uint8_t& clients,
                            uint16_t& minVisible) const {
    uint8_t usedIndex = 0;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        const Song& song = songs_[i];
        if (!song.used) continue;
        if (usedIndex++ != index) continue;

        if (key != nullptr) {
            strncpy(key, song.key, KEY_MAX - 1);
            key[KEY_MAX - 1] = '\0';
        }
        pos = song.pos;
        total = song.total;
        clients = 0;
        for (uint8_t slot = 0; slot < MAX_SLOTS; ++slot) {
            if (clients_[slot].hasKey &&
                strcmp(clients_[slot].key, song.key) == 0) {
                ++clients;
            }
        }
        minVisible = minVisibleLines(song.key);
        return true;
    }

    return false;
}

uint16_t PedalSyncModel::minVisibleLines(const char* key) const {
    uint16_t best = 0;

    for (uint8_t i = 0; i < MAX_SLOTS; ++i) {
        const ClientInfo& client = clients_[i];

        if (!client.hasKey || client.visible == 0) continue;
        if (strcmp(client.key, key) != 0) continue;

        if (best == 0 || client.visible < best) {
            best = client.visible;
        }
    }

    return best;
}