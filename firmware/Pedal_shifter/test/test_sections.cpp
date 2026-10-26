// Pruebas en PC del modo "por secciones" y del protocolo JSON v1.
//
//   g++ -std=c++14 -Wall -Isrc -I<ArduinoJson>/src test/test_sections.cpp src/PedalSyncModel.cpp -o /tmp/test_sections && /tmp/test_sections
//
// (ArduinoJson está en .pio/libdeps/<entorno>/ArduinoJson/src)

#include "PedalSyncModel.h"

#include <ArduinoJson.h>

#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <utility>
#include <vector>

using Mode = PedalSyncModel::Mode;

struct Msg { uint8_t slot; std::string line; };

struct Sink : ISyncSink {
    std::vector<Msg> out;
    std::vector<std::string> logs;
    std::vector<std::string> secLogs;   // categoría SEC del diagnóstico
    std::vector<std::pair<int, int>> modeRequests;

    void sendToSlot(uint8_t s, const char* l) override { out.push_back({s, l}); }
    void log(const char* m) override { logs.push_back(m); }
    void logSec(const char* m) override { secLogs.push_back(m); }
    void onModeRequested(uint8_t mode, uint8_t overlap) override {
        modeRequests.push_back({mode, overlap});
    }

    void clear() { out.clear(); logs.clear(); secLogs.clear(); modeRequests.clear(); }

    std::vector<std::string> lines(uint8_t slot) const {
        std::vector<std::string> r;
        for (auto& m : out) if (m.slot == slot) r.push_back(m.line);
        return r;
    }
    // Mensajes JSON de un tipo ("sec", "cfg") para un slot
    std::vector<std::string> json(uint8_t slot, const char* type) const {
        std::vector<std::string> r;
        const std::string prefix = std::string("{\"t\":\"") + type + "\"";
        for (auto& m : out)
            if (m.slot == slot && m.line.rfind(prefix, 0) == 0) r.push_back(m.line);
        return r;
    }
    bool anyLogContains(const char* text) const {
        for (auto& l : logs) if (l.find(text) != std::string::npos) return true;
        for (auto& l : secLogs) if (l.find(text) != std::string::npos) return true;
        return false;
    }
    bool secLogContains(const char* text) const {
        for (auto& l : secLogs) if (l.find(text) != std::string::npos) return true;
        return false;
    }
};

static int fails = 0;
#define CHECK(c) do { if (!(c)) { printf("FAIL line %d: %s\n", __LINE__, #c); fails++; } } while (0)

static bool starts(const std::string& s, const char* p) { return s.rfind(p, 0) == 0; }

// Parsea una línea y comprueba que sea JSON válido y termine en '\n'
static bool parse(const std::string& line, JsonDocument& doc) {
    if (line.empty() || line.back() != '\n') return false;
    return !deserializeJson(doc, line.c_str());
}

static std::string lastSec(const Sink& s, uint8_t slot) {
    auto v = s.json(slot, "sec");
    return v.empty() ? std::string() : v.back();
}

// hello JSON
static std::string hello(const char* key, int visible, int total, float pos,
                         const char* sections = nullptr) {
    char b[1600];
    if (sections)
        snprintf(b, sizeof b, "{\"t\":\"hello\",\"v\":1,\"song\":\"%s\",\"visible\":%d,\"total\":%d,\"pos\":%.2f,\"sections\":%s}",
                 key, visible, total, (double)pos, sections);
    else
        snprintf(b, sizeof b, "{\"t\":\"hello\",\"v\":1,\"song\":\"%s\",\"visible\":%d,\"total\":%d,\"pos\":%.2f}",
                 key, visible, total, (double)pos);
    return b;
}

static const char* SECS5 = "[[2,\"Intro\"],[5,\"Verso 1\"],[18,\"Coro\"],[27,\"Verso 2\"],[42,\"Puente\"]]";

struct Rig {
    Sink sink;
    PedalSyncModel m;
    Rig() { m.begin(&sink, 2.0f, 150); }
    void connect(uint8_t slot) { m.onClientConnected(slot); }
    void send(uint8_t slot, const std::string& line) { m.onClientLine(slot, line.c_str()); }
};

int main() {
    // ---------------------------------------------------------------- 1
    // Cliente v1 en modo LINEAS: cfg JSON + POS de texto + MINV (sin sec)
    {
        Rig r; r.connect(0);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        auto cfg = r.sink.json(0, "cfg");
        CHECK(cfg.size() == 1);
        JsonDocument d; CHECK(parse(cfg[0], d));
        CHECK(std::string(d["mode"] | "") == "lines");
        CHECK((d["overlapPercent"] | -1) == 30);
        CHECK(std::fabs((d["linesPerSec"] | 0.0f) - 2.0f) < 0.001f);
        CHECK((d["rampMs"] | 0) == 150);
        CHECK(r.sink.json(0, "sec").empty());
        auto all = r.sink.lines(0);
        CHECK(all.size() == 3 && starts(all[1], "POS k1 0.00 0") && starts(all[2], "MINV k1 14"));
        CHECK(r.m.clientProto(0) == 1);
    }

    // ---------------------------------------------------------------- 2
    // Cliente de TEXTO: el CFG de siempre, nunca JSON
    {
        Rig r; r.connect(0);
        r.m.onClientLine(0, "HELLO k1 14 86 0.00");
        auto all = r.sink.lines(0);
        CHECK(all.size() == 3 && all[0] == "CFG 2.00 150\n");
        CHECK(r.m.clientProto(0) == 0);
        r.m.setMode(Mode::SECTIONS, 30);
        r.sink.clear();
        r.m.sectionStep(+1);
        for (auto& mm : r.sink.out) CHECK(mm.line[0] != '{');
    }

    // ---------------------------------------------------------------- 3
    // Join en modo SECCIONES: cfg + sec(join), index -1, next = primera sección
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        auto cfg = r.sink.json(0, "cfg"); CHECK(cfg.size() == 1);
        JsonDocument c; CHECK(parse(cfg[0], c)); CHECK(std::string(c["mode"] | "") == "sections");
        auto sec = r.sink.json(0, "sec"); CHECK(sec.size() == 1);
        JsonDocument d; CHECK(parse(sec[0], d));
        CHECK(std::string(d["song"] | "") == "k1");
        CHECK(std::string(d["cause"] | "") == "join");
        CHECK((d["changed"] | true) == false);
        CHECK((d["index"] | 99) == -1);
        CHECK((d["count"] | 0) == 5);
        CHECK(d["cur"].isNull() && d["prev"].isNull());
        CHECK((d["next"]["i"] | -1) == 0 && (d["next"]["line"] | -1) == 2);
        CHECK(std::string(d["next"]["label"] | "") == "Intro");
        // en modo secciones NO se manda POS
        for (auto& l : r.sink.lines(0)) CHECK(!starts(l, "POS "));
    }

    // ---------------------------------------------------------------- 4
    // Toques: índices 0,1,2; prev/cur/next; pos coherente; seq creciente
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        r.send(0, hello("k1", 14, 86, 0, SECS5)); r.sink.clear();
        const int expectLine[3] = {2, 5, 18};
        uint32_t lastSeq = 0;
        for (int i = 0; i < 3; i++) {
            r.m.sectionStep(+1);
            JsonDocument d; CHECK(parse(lastSec(r.sink, 0), d));
            CHECK((d["index"] | 99) == i);
            CHECK((d["cur"]["line"] | -1) == expectLine[i]);
            CHECK(std::string(d["cause"] | "") == "next");
            CHECK((d["changed"] | false) == true);
            CHECK(std::fabs((d["pos"] | -1.0f) - (float)expectLine[i]) < 0.01f);
            const uint32_t seq = d["seq"] | 0u;
            CHECK(seq > lastSeq); lastSeq = seq;
            if (i == 0) CHECK(d["prev"].isNull());
            else CHECK((d["prev"]["i"] | -1) == i - 1);
            CHECK((d["next"]["i"] | -1) == i + 1);
        }
        int8_t idx; uint8_t cnt; uint32_t seq; uint16_t cs;
        CHECK(r.m.sectionState("k1", idx, cnt, seq, cs)); CHECK(idx == 2 && cnt == 5 && seq == lastSeq);
        float p; CHECK(r.m.getSongPos("k1", p)); CHECK(p == 18.0f);
        CHECK(!r.m.isMoving());
    }

    // ---------------------------------------------------------------- 5
    // Extremos: pasado el final no avanza (changed=false) pero igual avisa
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        for (int i = 0; i < 5; i++) r.m.sectionStep(+1);
        r.sink.clear(); r.m.sectionStep(+1);
        JsonDocument d; CHECK(parse(lastSec(r.sink, 0), d));
        CHECK((d["index"] | 99) == 4 && (d["changed"] | true) == false);
        CHECK(d["next"].isNull());
        // hacia atrás hasta -1
        for (int i = 0; i < 5; i++) r.m.sectionStep(-1);
        r.sink.clear(); r.m.sectionStep(-1);
        JsonDocument e; CHECK(parse(lastSec(r.sink, 0), e));
        CHECK((e["index"] | 99) == -1 && (e["changed"] | true) == false);
        CHECK(e["cur"].isNull() && std::fabs((e["pos"] | 9.0f)) < 0.01f);
    }

    // ---------------------------------------------------------------- 6
    // HOME / END en modo secciones
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.m.sectionStep(+1); r.m.sectionStep(+1);
        r.sink.clear(); r.m.goEnd();
        JsonDocument d; CHECK(parse(lastSec(r.sink, 0), d));
        CHECK(std::string(d["cause"] | "") == "end" && (d["index"] | 99) == 4);
        CHECK(std::fabs((d["pos"] | 0.0f) - 86.0f) < 0.01f);
        r.sink.clear(); r.m.goHome();
        JsonDocument e; CHECK(parse(lastSec(r.sink, 0), e));
        CHECK(std::string(e["cause"] | "") == "home" && (e["index"] | 99) == -1);
        for (auto& l : r.sink.lines(0)) CHECK(!starts(l, "POS "));
    }

    // ---------------------------------------------------------------- 7
    // Varios clientes: todos reciben cada sec (mismo seq); otra canción no
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30);
        r.connect(0); r.connect(1); r.connect(2);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.send(1, hello("k1", 9, 86, 0, SECS5));
        r.send(2, hello("k2", 14, 50, 0, "[[3,\"A\"],[20,\"B\"]]"));
        r.sink.clear(); r.m.sectionStep(+1);
        JsonDocument a, b, c;
        CHECK(parse(lastSec(r.sink, 0), a)); CHECK(parse(lastSec(r.sink, 1), b)); CHECK(parse(lastSec(r.sink, 2), c));
        CHECK((a["seq"] | 0) == (b["seq"] | 1) && (a["index"] | 9) == 0 && (b["index"] | 9) == 0);
        CHECK(std::string(a["song"] | "") == "k1" && std::string(c["song"] | "") == "k2");
        // el toque movió las DOS canciones, cada una dentro de su rango
        CHECK((c["index"] | 9) == 0 && (c["count"] | 0) == 2 && (c["cur"]["line"] | -1) == 3);
        CHECK(r.sink.json(0, "sec").size() == 1 && r.sink.json(2, "sec").size() == 1);
        r.m.sectionStep(+1); r.m.sectionStep(+1);
        JsonDocument c2; CHECK(parse(lastSec(r.sink, 2), c2));
        CHECK((c2["index"] | 9) == 1 && (c2["changed"] | true) == false);   // k2 ya llegó a su último
    }

    // ---------------------------------------------------------------- 8
    // Quien se une a mitad de canción recibe la sección vigente (join)
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.m.sectionStep(+1); r.m.sectionStep(+1);
        uint32_t seqBefore; { int8_t i; uint8_t c; uint16_t cs; r.m.sectionState("k1", i, c, seqBefore, cs); }
        r.sink.clear(); r.send(1, hello("k1", 9, 86, 0, SECS5));
        JsonDocument d; CHECK(parse(lastSec(r.sink, 1), d));
        CHECK(std::string(d["cause"] | "") == "join" && (d["index"] | 9) == 1 && (d["seq"] | 0u) == seqBefore);
        CHECK(r.sink.json(0, "sec").empty());       // el que ya estaba no recibe nada nuevo
    }

    // ---------------------------------------------------------------- 9
    // Lista distinta de otro cliente: se rechaza y se anota
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.m.sectionStep(+1);
        r.sink.clear();
        r.send(1, hello("k1", 9, 86, 0, "[[2,\"Otra\"],[30,\"Cosa\"]]"));
        CHECK(r.sink.anyLogContains("rechazada"));
        int8_t i; uint8_t c; uint32_t s; uint16_t cs; r.m.sectionState("k1", i, c, s, cs);
        CHECK(c == 5 && i == 0);
        // el cliente 1 igual recibe el estado de la lista vigente (5 secciones)
        JsonDocument d; CHECK(parse(lastSec(r.sink, 1), d)); CHECK((d["count"] | 0) == 5);
    }

    // ---------------------------------------------------------------- 10
    // El dueño manda otra lista: se reemplaza, índice recalculado, los demás se enteran (reset)
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.send(1, hello("k1", 9, 86, 0, SECS5));
        r.m.sectionStep(+1); r.m.sectionStep(+1); r.m.sectionStep(+1);    // índice 2, pos 18
        r.sink.clear();
        r.send(0, hello("k1", 14, 86, 18, "[[2,\"Intro\"],[10,\"Nueva\"],[18,\"Coro\"]]"));
        JsonDocument d; CHECK(parse(lastSec(r.sink, 1), d));
        CHECK(std::string(d["cause"] | "") == "reset" && (d["count"] | 0) == 3 && (d["index"] | 9) == 2);
        CHECK(!r.sink.json(0, "sec").empty());                       // el dueño también ve el nuevo estado
    }

    // ---------------------------------------------------------------- 11
    // Si el dueño se desconecta, la próxima lista (distinta) se adopta
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.send(1, hello("k1", 9, 86, 0, SECS5));
        r.m.onClientDisconnected(0);
        r.sink.clear();
        r.send(1, hello("k1", 9, 86, 0, "[[4,\"X\"],[40,\"Y\"]]"));
        int8_t i; uint8_t c; uint32_t s; uint16_t cs; r.m.sectionState("k1", i, c, s, cs);
        CHECK(c == 2);
    }

    // ---------------------------------------------------------------- 12
    // Listas inválidas: se ignoran, pero el hello se procesa igual
    {
        const char* bad[] = {
            "[[5,\"A\"],[3,\"B\"]]",         // no crecientes
            "[[5,\"A\"],[5,\"B\"]]",         // repetidas
            "[[90,\"Fuera\"]]",              // línea >= total (86)
            "[[-1,\"Neg\"]]",
            "[[5]]",                         // par incompleto
            "[5,10]",                        // no son pares
            "\"hola\"",                      // no es un arreglo
        };
        for (auto b : bad) {
            Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
            r.send(0, hello("k1", 14, 86, 0, b));
            CHECK(r.m.songCount() == 1);
            int8_t i; uint8_t c; uint32_t s; uint16_t cs; CHECK(r.m.sectionState("k1", i, c, s, cs));
            CHECK(c == 0);
        }
    }

    // ---------------------------------------------------------------- 13
    // Más de 32 secciones: se toman las primeras 32
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        std::string list = "[";
        for (int i = 0; i < 40; i++) { char b[40]; snprintf(b, sizeof b, "%s[%d,\"S%d\"]", i ? "," : "", i * 2 + 1, i); list += b; }
        list += "]";
        r.send(0, hello("k1", 14, 200, 0, list.c_str()));
        int8_t i; uint8_t c; uint32_t s; uint16_t cs; r.m.sectionState("k1", i, c, s, cs);
        CHECK(c == 32);
    }

    // ---------------------------------------------------------------- 14
    // Etiquetas: UTF-8 en el límite, comillas, barra invertida y controles
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        // "€" mide 3 bytes: 9 veces = 27 bytes; el límite es 20 -> 6 caracteres (18 bytes)
        std::string euros; for (int i = 0; i < 9; i++) euros += "\xE2\x82\xAC";
        // "ñ" mide 2 bytes: 15 veces = 30 bytes -> 10 caracteres (20 bytes)
        std::string enies; for (int i = 0; i < 15; i++) enies += "\xC3\xB1";
        std::string list = std::string("[[1,\"") + euros + "\"],[2,\"" + enies +
                           "\"],[3,\"a\\\"b\\\\c\"],[4,\"tab\\tsalto\\ncr\\r\"],[5,\"\\u0001\\u0002\"]]";
        r.send(0, hello("k1", 14, 86, 0, list.c_str()));
        for (int step = 0; step < 5; step++) {
            r.sink.clear(); r.m.sectionStep(+1);
            JsonDocument d; CHECK(parse(lastSec(r.sink, 0), d));      // siempre JSON válido
            const std::string label = d["cur"]["label"] | "";
            if (step == 0) { CHECK(label.size() == 18); CHECK(label == [&]{ std::string e; for (int i = 0; i < 6; i++) e += "\xE2\x82\xAC"; return e; }()); }
            if (step == 1) CHECK(label.size() == 20);
            if (step == 2) CHECK(label == "a\"b\\c");
            if (step == 3) CHECK(label == "tab\tsalto\ncr\r");
            if (step == 4) CHECK(label == "\x01\x02");
            // ningún byte de continuación suelto al final (UTF-8 completo)
            if (!label.empty()) {
                size_t k = label.size() - 1;
                while (k > 0 && (static_cast<unsigned char>(label[k]) & 0xC0) == 0x80) --k;
                const unsigned char lead = static_cast<unsigned char>(label[k]);
                const size_t need = lead >= 0xF0 ? 4 : lead >= 0xE0 ? 3 : lead >= 0xC0 ? 2 : 1;
                CHECK(label.size() - k == need);
            }
        }
    }

    // ---------------------------------------------------------------- 15
    // Peor caso de tamaño: etiquetas de 20 bytes de control (escapan a \u00XX) y clave larga
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        std::string ctl; for (int i = 0; i < 20; i++) ctl += "\\u0001";
        std::string list = "[[1,\"" + ctl + "\"],[2,\"" + ctl + "\"],[3,\"" + ctl + "\"]]";
        std::string key(38, 'k');
        r.send(0, hello(key.c_str(), 14, 86, 0, list.c_str()));
        r.sink.clear(); r.m.sectionStep(+1); r.m.sectionStep(+1);
        auto v = r.sink.json(0, "sec"); CHECK(v.size() == 2);
        for (auto& line : v) { JsonDocument d; CHECK(parse(line, d)); CHECK(line.size() < 640); }
        JsonDocument d; CHECK(parse(v.back(), d)); CHECK(std::string(d["cur"]["label"] | "").size() == 20);
    }

    // ---------------------------------------------------------------- 16
    // Basura: no cambia el estado ni responde
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0);
        r.send(0, hello("k1", 14, 86, 0, SECS5)); r.sink.clear();
        const char* bad[] = {
            "{", "{}", "{\"t\":\"hello\"", "{\"v\":1}", "{\"t\":\"hello\",\"v\":2,\"song\":\"k9\",\"visible\":1,\"total\":5,\"pos\":0}",
            "{\"t\":\"hello\",\"v\":1,\"song\":\"k9\",\"visible\":\"x\",\"total\":5,\"pos\":0}",
            "{\"t\":\"hello\",\"v\":1,\"song\":\"\",\"visible\":1,\"total\":5,\"pos\":0}",
            "{\"t\":\"hello\",\"v\":1,\"song\":\"con espacio\",\"visible\":1,\"total\":5,\"pos\":0}",
            "{\"t\":\"hello\",\"v\":1,\"song\":\"k9\",\"visible\":1,\"total\":0,\"pos\":0}",
            "{\"t\":\"hello\",\"v\":1,\"song\":\"k9\",\"visible\":70000,\"total\":5,\"pos\":0}",
            "{\"t\":\"raro\",\"v\":1}", "[1,2,3]", "{\"t\":5,\"v\":1}", "{\"t\":\"setmode\",\"v\":1,\"mode\":\"turbo\"}",
        };
        for (auto b : bad) r.send(0, b);
        CHECK(r.m.songCount() == 1);
        CHECK(r.sink.json(0, "sec").empty());
        CHECK(r.m.mode() == Mode::SECTIONS);
        int8_t i; uint8_t c; uint32_t s; uint16_t cs; r.m.sectionState("k1", i, c, s, cs); CHECK(i == -1 && c == 5);
        // una línea larguísima tampoco rompe nada
        std::string big = "{\"t\":\"hello\",\"v\":1,\"song\":\"k9\",\"junk\":\"" + std::string(5000, 'x') + "\"}";
        r.send(0, big); CHECK(r.m.songCount() == 1);
    }

    // ---------------------------------------------------------------- 17
    // getcfg y resync
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 40); r.connect(0); r.connect(1);
        r.send(1, "{\"t\":\"getcfg\",\"v\":1}");           // sin abrir canción
        auto cfg = r.sink.json(1, "cfg"); CHECK(cfg.size() == 1);
        JsonDocument c; CHECK(parse(cfg[0], c)); CHECK(std::string(c["mode"] | "") == "sections" && (c["overlapPercent"] | 0) == 40);
        CHECK(r.m.clientProto(1) == 1);

        r.send(0, hello("k1", 14, 86, 0, SECS5)); r.m.sectionStep(+1); r.m.sectionStep(+1);
        r.sink.clear(); r.send(0, "{\"t\":\"resync\",\"v\":1,\"song\":\"k1\"}");
        CHECK(r.sink.json(0, "cfg").size() == 1);
        JsonDocument d; CHECK(parse(lastSec(r.sink, 0), d));
        CHECK(std::string(d["cause"] | "") == "resync" && (d["index"] | 9) == 1);
        // resync de una canción en la que no está: solo cfg
        r.sink.clear(); r.send(0, "{\"t\":\"resync\",\"v\":1,\"song\":\"otra\"}");
        CHECK(r.sink.json(0, "cfg").size() == 1 && r.sink.json(0, "sec").empty());
    }

    // ---------------------------------------------------------------- 18
    // setmode desde la app
    {
        Rig r; r.connect(0); r.connect(1); r.connect(2);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.send(1, "{\"t\":\"getcfg\",\"v\":1}");           // v1 sin canción
        r.m.onClientLine(2, "HELLO k1 9 86 0.00");         // cliente de texto
        r.sink.clear();

        r.send(0, "{\"t\":\"setmode\",\"v\":1,\"mode\":\"sections\",\"overlapPercent\":40}");
        CHECK(r.m.mode() == Mode::SECTIONS && r.m.overlapPercent() == 40);
        CHECK(r.sink.modeRequests.size() == 1 && r.sink.modeRequests[0].first == 1 && r.sink.modeRequests[0].second == 40);
        // cfg a TODOS los clientes v1 (también al que no tiene canción), nada de JSON al de texto
        for (uint8_t s : {0, 1}) {
            auto cfg = r.sink.json(s, "cfg"); CHECK(cfg.size() == 1);
            JsonDocument d; CHECK(parse(cfg[0], d)); CHECK(std::string(d["mode"] | "") == "sections" && (d["overlapPercent"] | 0) == 40);
        }
        for (auto& l : r.sink.lines(2)) CHECK(l[0] != '{');
        // el cliente con canción recibe el estado nuevo (cause mode); el de texto, un POS
        JsonDocument st; CHECK(parse(lastSec(r.sink, 0), st)); CHECK(std::string(st["cause"] | "") == "mode");
        bool textGotPos = false; for (auto& l : r.sink.lines(2)) if (starts(l, "POS k1")) textGotPos = true;
        CHECK(textGotPos);

        // los mismos valores otra vez: responde cfg pero no pide guardar de nuevo
        r.sink.clear();
        r.send(1, "{\"t\":\"setmode\",\"v\":1,\"mode\":\"sections\",\"overlapPercent\":40}");
        CHECK(r.sink.modeRequests.empty());
        CHECK(r.sink.json(1, "cfg").size() == 1 && r.sink.json(0, "cfg").size() == 1);
        CHECK(r.sink.json(0, "sec").empty());              // sin cambio de modo: no se reposiciona nada

        // overlap fuera de rango se acota; modo omitido deja el actual
        r.sink.clear();
        r.send(0, "{\"t\":\"setmode\",\"v\":1,\"overlapPercent\":90}");
        CHECK(r.m.mode() == Mode::SECTIONS && r.m.overlapPercent() == 60);
        CHECK(r.sink.modeRequests.size() == 1 && r.sink.modeRequests[0].second == 60);

        // modo desconocido: se ignora por completo
        r.sink.clear();
        r.send(0, "{\"t\":\"setmode\",\"v\":1,\"mode\":\"turbo\"}");
        CHECK(r.sink.out.empty() && r.sink.modeRequests.empty() && r.m.mode() == Mode::SECTIONS);
    }

    // ---------------------------------------------------------------- 19
    // Cambio de modo desde la web del pedal (setMode directo): también avisa a las apps
    {
        Rig r; r.connect(0); r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.sink.clear(); r.m.setMode(Mode::SECTIONS, 25);
        CHECK(r.sink.modeRequests.empty());                // no es un pedido de app: nadie lo guarda dos veces
        JsonDocument d; CHECK(parse(r.sink.json(0, "cfg").back(), d)); CHECK(std::string(d["mode"] | "") == "sections" && (d["overlapPercent"] | 0) == 25);
    }

    // ---------------------------------------------------------------- 20
    // Líneas -> secciones deriva el índice de la posición; secciones -> líneas la conserva
    {
        Rig r; r.connect(0); r.send(0, hello("k1", 14, 86, 0, SECS5));
        uint32_t t = 1000; r.m.motionStart(+1, t);
        for (; t < 1000 + 12000; t += 5) r.m.update(t);          // ~hasta línea 24
        r.m.motionStop(); for (uint32_t e = t + 500; t < e; t += 5) r.m.update(t);
        float p; r.m.getSongPos("k1", p); CHECK(p > 18.0f && p < 27.0f);
        r.sink.clear(); r.m.setMode(Mode::SECTIONS, 30);
        JsonDocument d; CHECK(parse(lastSec(r.sink, 0), d)); CHECK((d["index"] | 9) == 2 && std::string(d["cause"] | "") == "mode");
        // un toque sigue desde ahí
        r.sink.clear(); r.m.sectionStep(+1);
        JsonDocument e; CHECK(parse(lastSec(r.sink, 0), e)); CHECK((e["index"] | 9) == 3);
        // de vuelta a líneas: POS de texto con la posición de la sección
        r.sink.clear(); r.m.setMode(Mode::LINES, 30);
        float q; r.m.getSongPos("k1", q); CHECK(q == 27.0f);
        bool gotPos = false; for (auto& l : r.sink.lines(0)) if (starts(l, "POS k1 27.00 0")) gotPos = true;
        CHECK(gotPos); CHECK(r.sink.json(0, "sec").empty());
        // y el scroll por líneas vuelve a funcionar
        t += 10; r.m.motionStart(+1, t); for (uint32_t e2 = t + 1000; t < e2; t += 5) r.m.update(t);
        CHECK(r.m.isMoving());
    }

    // ---------------------------------------------------------------- 21
    // En modo secciones el ESP32 no mueve la posición de forma continua
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.sink.clear(); uint32_t t = 1000;
        r.m.motionStart(+1, t); for (; t < 4000; t += 5) r.m.update(t); r.m.motionStop();
        CHECK(!r.m.isMoving()); CHECK(r.sink.out.empty());
        float p; r.m.getSongPos("k1", p); CHECK(p == 0.0f);
    }

    // ---------------------------------------------------------------- 22
    // sectionStep no hace nada en modo líneas
    {
        Rig r; r.connect(0); r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.sink.clear(); r.m.sectionStep(+1); r.m.sectionStep(-1);
        CHECK(r.sink.out.empty());
        float p; r.m.getSongPos("k1", p); CHECK(p == 0.0f);
    }

    // ---------------------------------------------------------------- 23
    // Canción sin secciones: pagina (visible 14, contexto 30 % -> páginas de 10 líneas)
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 35, 0));
        r.m.onClientLine(1, "HELLO k1 20 35 0.00");        // cliente de texto en la misma canción
        r.sink.clear(); r.m.sectionStep(+1);
        JsonDocument d; CHECK(parse(lastSec(r.sink, 0), d));
        CHECK(std::string(d["cause"] | "") == "page" && (d["count"] | 9) == 0 && d["cur"].isNull());
        CHECK(std::fabs((d["pos"] | 0.0f) - 10.0f) < 0.01f);
        bool textPos = false; for (auto& l : r.sink.lines(1)) if (starts(l, "POS k1 10.00 0")) textPos = true;
        CHECK(textPos);
        r.m.sectionStep(+1); r.m.sectionStep(+1); r.m.sectionStep(+1);
        float p; r.m.getSongPos("k1", p); CHECK(p == 35.0f);                         // tope en el final
        r.sink.clear(); r.m.sectionStep(+1);
        JsonDocument e; CHECK(parse(lastSec(r.sink, 0), e)); CHECK((e["changed"] | true) == false);
        r.m.sectionStep(-1); r.m.getSongPos("k1", p); CHECK(p == 25.0f);
    }

    // ---------------------------------------------------------------- 24
    // Un cliente v1 que cambia de canción: la lista y el dueño de la anterior se liberan
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.send(1, hello("k1", 9, 86, 0, SECS5));
        r.send(0, hello("k2", 14, 50, 0, "[[3,\"A\"]]"));
        CHECK(r.m.songCount() == 2);
        r.sink.clear(); r.m.sectionStep(+1);
        JsonDocument a; CHECK(parse(lastSec(r.sink, 0), a)); CHECK(std::string(a["song"] | "") == "k2");
        JsonDocument b; CHECK(parse(lastSec(r.sink, 1), b)); CHECK(std::string(b["song"] | "") == "k1");
        // leave JSON
        r.send(1, "{\"t\":\"leave\",\"v\":1,\"song\":\"k1\"}"); CHECK(r.m.songCount() == 1);
    }

    // ---------------------------------------------------------------- 25
    // Desconexión y reconexión en el mismo slot: arranca limpio (protocolo de texto)
    {
        Rig r; r.connect(0); r.send(0, hello("k1", 14, 86, 0, SECS5)); CHECK(r.m.clientProto(0) == 1);
        r.m.onClientDisconnected(0); CHECK(r.m.clientProto(0) == 0); CHECK(r.m.songCount() == 0);
        r.connect(0); r.sink.clear(); r.m.onClientLine(0, "HELLO k1 14 86 0.00");
        CHECK(r.sink.lines(0)[0] == "CFG 2.00 150\n");
    }

    // ---------------------------------------------------------------- 26
    // Diagnóstico: lo de secciones va a la categoría SEC y el resto a SYNC
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        CHECK(r.sink.secLogContains("secciones adoptadas") && r.sink.secLogContains("n=5"));
        r.sink.clear(); r.m.sectionStep(+1);
        CHECK(r.sink.secLogContains("#") && r.sink.secLogContains("next") && r.sink.secLogContains("cliente(s)"));
        CHECK(r.sink.logs.empty());                                 // nada de secciones en SYNC
        // lista rechazada y lista inválida también son SEC
        r.sink.clear(); r.send(1, hello("k1", 9, 86, 0, "[[2,\"Otra\"]]"));
        CHECK(r.sink.secLogContains("rechazada"));
        r.sink.clear(); r.send(1, hello("k1", 9, 86, 0, "[[9,\"A\"],[3,\"B\"]]"));
        CHECK(r.sink.secLogContains("inválida"));
        // setmode y el JSON inválido siguen siendo SYNC
        r.sink.clear(); r.send(0, "{\"t\":\"setmode\",\"v\":1,\"mode\":\"lines\"}");
        CHECK(!r.sink.logs.empty() && r.sink.anyLogContains("setmode"));
        r.sink.clear(); r.send(0, "{");
        CHECK(!r.sink.logs.empty() && r.sink.secLogs.empty());
    }

    // ---------------------------------------------------------------- 27
    // songSections(): índice, cantidad, seq, checksum y etiqueta de la sección activa
    {
        Rig r; r.m.setMode(Mode::SECTIONS, 30); r.connect(0); r.connect(1);
        r.send(0, hello("k1", 14, 86, 0, SECS5));
        r.send(1, hello("k2", 14, 50, 0, "[[3,\"A\"],[20,\"B\"]]"));
        int8_t idx; uint8_t cnt; uint32_t seq; uint16_t cs; char label[21];
        CHECK(r.m.songSections(0, idx, cnt, seq, cs, label, sizeof label));
        CHECK(idx == -1 && cnt == 5 && std::string(label).empty() && cs != 0);       // todavía no empezó ninguna
        r.m.sectionStep(+1); r.m.sectionStep(+1); r.m.sectionStep(+1);
        CHECK(r.m.songSections(0, idx, cnt, seq, cs, label, sizeof label));
        CHECK(idx == 2 && std::string(label) == "Coro" && seq == 3);
        CHECK(r.m.songSections(1, idx, cnt, seq, cs, label, sizeof label));
        CHECK(idx == 1 && std::string(label) == "B" && cnt == 2);                    // k2 llegó a su último y se quedó ahí
        // songSections() y sectionState() tienen que coincidir para la misma canción
        int8_t i1; uint8_t c1; uint32_t s1; uint16_t cs1; char l1[21];
        int8_t i2; uint8_t c2; uint32_t s2; uint16_t cs2;
        CHECK(r.m.songSections(0, i1, c1, s1, cs1, l1, sizeof l1));
        CHECK(r.m.sectionState("k1", i2, c2, s2, cs2));
        CHECK(i1 == i2 && c1 == c2 && s1 == s2 && cs1 == cs2);
        CHECK(cs1 != cs);                                                             // k1 y k2 tienen listas distintas
        CHECK(!r.m.songSections(2, idx, cnt, seq, cs, label, sizeof label));          // no hay una tercera
        CHECK(r.m.songSections(0, idx, cnt, seq, cs, nullptr, 0));                    // label es opcional
    }

    printf(fails ? "\n%d FALLAS\n" : "\nTODO OK (secciones y protocolo JSON v1)\n", fails);
    return fails ? 1 : 0;
}