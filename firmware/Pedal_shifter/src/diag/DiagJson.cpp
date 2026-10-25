#include "DiagJson.h"

namespace {

void key(String& out, const char* name) {
    out += '"';
    out += name;
    out += "\":";
}

void str(String& out, const char* name, const char* value) {
    key(out, name);
    out += '"';
    DiagJson::appendEscaped(out, value);
    out += '"';
}

void num(String& out, const char* name, unsigned long value) {
    key(out, name);
    out += String(value);
}

void snum(String& out, const char* name, long value) {
    key(out, name);
    out += String(value);
}

void flag(String& out, const char* name, bool value) {
    key(out, name);
    out += value ? "true" : "false";
}

void button(String& out, const char* name, uint8_t pin, bool raw, bool stable,
            const char* state, uint32_t stateMs, uint16_t edges10s,
            uint32_t edgesTotal) {
    out += '"';
    out += name;
    out += "\":{";
    num(out, "pin", pin);
    out += ',';
    flag(out, "raw", raw);
    out += ',';
    flag(out, "stable", stable);
    out += ',';
    str(out, "state", state);
    out += ',';
    num(out, "stateMs", stateMs);
    out += ',';
    num(out, "edges10s", edges10s);
    out += ',';
    num(out, "edgesTotal", edgesTotal);
    out += '}';
}

}  // namespace

void DiagJson::appendEscaped(String& out, const char* text) {
    for (const unsigned char* p = reinterpret_cast<const unsigned char*>(text);
         *p; ++p) {
        const unsigned char c = *p;

        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (c < 0x20) {
                    char buffer[8];
                    snprintf(buffer, sizeof(buffer), "\\u%04x", c);
                    out += buffer;
                } else {
                    out += static_cast<char>(c);
                }
        }
    }
}

void DiagJson::build(const DiagSnapshot& s, String& out) {
    out += '{';

    num(out, "uptimeMs", s.uptimeMs);

    // Sistema
    out += ",\"sys\":{";
    num(out, "heapFree", s.heapFree);
    out += ',';
    num(out, "heapMin", s.heapMin);
    out += ',';
    snum(out, "rssi", s.rssi);
    out += ',';
    flag(out, "wifi", s.wifiConnected);
    out += ',';
    flag(out, "ap", s.apMode);
    out += ',';
    str(out, "ip", s.ip);
    out += ',';
    str(out, "ssid", s.ssid);
    out += '}';

    // Conexiones
    out += ",\"conn\":{";
    flag(out, "bleEnabled", s.bleEnabled);
    out += ',';
    flag(out, "bleConnected", s.bleConnected);
    out += ',';
    flag(out, "tcpEnabled", s.tcpEnabled);
    out += ',';
    flag(out, "tcpRunning", s.tcpRunning);
    out += ',';
    num(out, "clients", s.tcpClients);
    out += ',';
    num(out, "port", s.tcpPort);
    out += '}';

    // Tiempos
    out += ",\"cfg\":{";
    num(out, "debounceMs", s.buttons.debounceMs);
    out += ',';
    num(out, "holdMs", s.holdMs);
    out += ',';
    num(out, "doubleMs", s.doubleMs);
    out += ',';
    num(out, "resetMs", s.resetMs);
    out += ',';
    str(out, "mode", s.sectionsMode ? "sections" : "lines");
    out += ',';
    num(out, "overlapPercent", s.overlapPercent);
    out += ',';
    num(out, "sectionHoldMs", s.sectionHoldMs);
    out += '}';

    // Pulsadores
    out += ",\"btn\":{";
    button(out, "up", s.pinUp, s.buttons.upRaw, s.buttons.upStable,
           s.buttons.upState, s.buttons.upStateMs, s.buttons.upEdges10s,
           s.buttons.upEdgesTotal);
    out += ',';
    button(out, "down", s.pinDown, s.buttons.downRaw, s.buttons.downStable,
           s.buttons.downState, s.buttons.downStateMs, s.buttons.downEdges10s,
           s.buttons.downEdgesTotal);
    out += ',';
    flag(out, "both", s.buttons.bothActive);
    out += '}';

    // Dispositivos
    out += ",\"devices\":[";
    for (uint8_t i = 0; i < s.deviceCount; ++i) {
        const DeviceDiag& d = s.devices[i];

        if (i) out += ',';

        out += '{';
        num(out, "slot", d.slot);
        out += ',';
        str(out, "ip", d.ip);
        out += ',';
        num(out, "connectedMs", d.connectedMs);
        out += ',';
        flag(out, "spoke", d.everSpoke);
        out += ',';
        num(out, "lastRxMs", d.lastRxMs);
        out += ',';
        num(out, "rxLines", d.rxLines);
        out += ',';
        flag(out, "hasSong", d.hasSong);
        out += ',';
        str(out, "song", d.key);
        out += ',';
        num(out, "visible", d.visible);
        out += ',';
        num(out, "total", d.total);
        out += ',';
        num(out, "proto", d.proto);
        out += '}';
    }
    out += ']';

    // Canciones compartidas
    out += ",\"songs\":[";
    for (uint8_t i = 0; i < s.songCount; ++i) {
        const SongDiag& g = s.songs[i];

        if (i) out += ',';

        out += '{';
        str(out, "key", g.key);
        out += ',';
        key(out, "pos");
        out += String(static_cast<double>(g.pos), 2);
        out += ',';
        num(out, "total", g.total);
        out += ',';
        num(out, "clients", g.clients);
        out += ',';
        num(out, "minVisible", g.minVisible);
        out += ',';
        snum(out, "sectionIndex", g.sectionIndex);
        out += ',';
        num(out, "sectionCount", g.sectionCount);
        out += ',';
        num(out, "seq", g.seq);
        out += ',';

        char checksum[8];
        snprintf(checksum, sizeof(checksum), "%04x",
                 static_cast<unsigned>(g.checksum));
        str(out, "checksum", checksum);

        out += ',';
        str(out, "label", g.label);
        out += '}';
    }
    out += ']';

    out += ',';
    flag(out, "moving", s.motionActive);

    // Registro
    out += ",\"log\":{";
    num(out, "seq", s.logSeq);
    out += ",\"items\":[";
    for (size_t i = 0; i < s.logCount; ++i) {
        const PedalDiag::Entry& e = s.log[i];

        if (i) out += ',';

        out += '{';
        num(out, "s", e.seq);
        out += ',';
        num(out, "t", e.ms);
        out += ',';
        str(out, "c", PedalDiag::catName(e.cat));
        out += ',';
        str(out, "m", e.msg);
        out += '}';
    }
    out += "]}";

    out += '}';
}