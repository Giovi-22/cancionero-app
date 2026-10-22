#include "PedalSyncModel.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace {

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

        songs_[i].used = false;
        songs_[i].key[0] = '\0';
        songs_[i].total = 0;
        songs_[i].pos = 0.0f;
    }

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

    ClientInfo& client = clients_[slot];

    const bool join = !(client.hasKey && strcmp(client.key, key) == 0);

    char previousKey[KEY_MAX];
    const bool changedSong = join && client.hasKey;

    if (changedSong) {
        memcpy(previousKey, client.key, KEY_MAX);
    }

    client.hasKey = true;
    memcpy(client.key, key, keyLength + 1);
    client.visible = static_cast<uint16_t>(visible);
    client.total = static_cast<uint16_t>(total);

    // Si el cliente venía de otra canción, esa pudo quedar sin nadie.
    pruneSongs();

    Song* song = findSong(key);

    if (song == nullptr) {
        song = allocSong();

        if (song == nullptr) return;  // No debería pasar: hay lugar para MAX_SLOTS.

        song->used = true;
        memcpy(song->key, key, keyLength + 1);
        song->total = static_cast<uint16_t>(total);
        song->pos = clampf(pos, 0.0f, static_cast<float>(total));
    } else {
        song->total = static_cast<uint16_t>(total);
        song->pos = clampf(song->pos, 0.0f, static_cast<float>(total));
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
        sendPos(slot, *song, active_);
    }

    // Si venía de otra canción, a los que se quedaron ahí les cambió el mínimo.
    if (changedSong) {
        broadcastMinVisible(previousKey);
    }

    broadcastMinVisible(key);
}

void PedalSyncModel::handleLeave(uint8_t slot, char* args) {
    char* cursor = args;
    char* key = nextToken(cursor);

    if (!key) return;

    ClientInfo& client = clients_[slot];

    if (client.hasKey && strcmp(client.key, key) == 0) {
        client.hasKey = false;
        client.key[0] = '\0';
        client.visible = 0;
        client.total = 0;

        pruneSongs();
        broadcastMinVisible(key);
    }
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
    if (sink_ == nullptr) return;

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
        }
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
        }
    }

    broadcastPositions(false);
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