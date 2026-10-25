#pragma once

#include <Arduino.h>

#include "../diag/PedalDiag.h"
#include "../input/PedalButtons.h"
#include "../network/PedalSocketServer.h"

/**
 * Todo lo que muestra la página de diagnóstico, en una sola estructura.
 * WebConfigServer la llena y DiagJson::build() la convierte a JSON, así el
 * armado del JSON no depende del hardware y se puede probar en una PC.
 */
struct DiagSnapshot {
    static const size_t MAX_LOG = 60;

    // Sistema
    uint32_t uptimeMs = 0;
    uint32_t heapFree = 0;
    uint32_t heapMin = 0;
    int rssi = 0;
    bool wifiConnected = false;
    bool apMode = false;
    char ip[24] = "";
    char ssid[40] = "";

    // Conexiones
    bool bleEnabled = false;
    bool bleConnected = false;
    bool tcpEnabled = false;
    bool tcpRunning = false;
    uint8_t tcpClients = 0;
    uint16_t tcpPort = 0;

    // Tiempos configurados (ms)
    uint32_t holdMs = 0;
    uint32_t doubleMs = 0;
    uint32_t resetMs = 0;

    // Modo del pedal
    bool sectionsMode = false;
    uint8_t overlapPercent = 0;
    uint32_t sectionHoldMs = 0;

    // Pulsadores
    ButtonSnapshot buttons;
    uint8_t pinUp = 0;
    uint8_t pinDown = 0;

    // Dispositivos y canciones
    uint8_t deviceCount = 0;
    DeviceDiag devices[PedalSocketServer::MAX_CLIENTS];
    uint8_t songCount = 0;
    SongDiag songs[PedalSocketServer::MAX_CLIENTS];
    bool motionActive = false;

    // Registro
    uint32_t logSeq = 0;
    size_t logCount = 0;
    PedalDiag::Entry log[MAX_LOG];
};

namespace DiagJson {

/** Agrega `text` a `out` escapado como contenido de una cadena JSON. */
void appendEscaped(String& out, const char* text);

/** Arma el JSON completo de la página de diagnóstico. */
void build(const DiagSnapshot& snapshot, String& out);

}  // namespace DiagJson