#include "PedalSyncModel.h"
#include <vector>
#include <string>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <cstdlib>

struct Msg { uint8_t slot; std::string line; };
struct Sink : ISyncSink {
    std::vector<Msg> out;
    void sendToSlot(uint8_t s, const char* l) override { out.push_back({s, l}); }
    void clear() { out.clear(); }
    std::vector<std::string> forSlot(uint8_t s) { std::vector<std::string> r; for (auto& m : out) if (m.slot==s) r.push_back(m.line); return r; }
};
static int fails = 0;
#define CHECK(c) do { if(!(c)) { printf("FAIL line %d: %s\n", __LINE__, #c); fails++; } } while(0)
static bool startsWith(const std::string& s, const char* p){ return s.rfind(p,0)==0; }
static float lastPos(Sink& k, uint8_t slot, int* movingOut=nullptr) {
    float pos=NAN; for (auto& m : k.out) if (m.slot==slot && startsWith(m.line,"POS ")) { char key[64]; int mv; float p; sscanf(m.line.c_str(),"POS %63s %f %d",key,&p,&mv); pos=p; if(movingOut)*movingOut=mv; } return pos; }

int main() {
    Sink sink; PedalSyncModel m; m.begin(&sink, 2.0f, 150);

    // 1) HELLO inicial: responde CFG + POS (pos del primero, clampeada)
    m.onClientConnected(0);
    m.onClientLine(0, "HELLO songA.x1 7 40 3.5");
    auto r0 = sink.forSlot(0);
    // Un cliente de texto recibe CFG + POS + MINV (el MINV avisa la pantalla más chica)
    CHECK(r0.size()==3); CHECK(r0.size()>=3 && r0[0]=="CFG 2.00 150\n"); CHECK(r0.size()>=3 && r0[1]=="POS songA.x1 3.50 0\n"); CHECK(r0.size()>=3 && r0[2]=="MINV songA.x1 7\n");

    // 2) Segundo cliente, misma canción: recibe la pos del SERVIDOR, no la suya
    sink.clear(); m.onClientConnected(1);
    m.onClientLine(1, "HELLO songA.x1 12 40 0.00");
    CHECK(lastPos(sink,1)==3.5f);
    CHECK(m.minVisibleLines("songA.x1")==7);

    // 3) Re-HELLO (cambió la letra): actualiza datos y solo avisa el nuevo MINV (ni CFG ni POS)
    sink.clear(); m.onClientLine(0, "HELLO songA.x1 5 40 3.5");
    CHECK(!sink.out.empty());
    for (auto& mm : sink.out) CHECK(startsWith(mm.line, "MINV "));
    CHECK(m.minVisibleLines("songA.x1")==5);

    // 4) Movimiento: apretar ABAJO 1.0 s, soltar, esperar frenado. Esperado: 0.15+1.7+0.15 = 2.0 líneas
    sink.clear(); uint32_t t = 1000; m.motionStart(+1, t);
    int posMsgs = 0; 
    for (; t < 2000; t += 3) m.update(t);          // 1.0 s apretado
    m.motionStop();
    for (; t < 2400; t += 3) m.update(t);          // frenado
    CHECK(!m.isMoving());
    float p; CHECK(m.getSongPos("songA.x1", p));
    printf("pos tras 1.0s de pedal: %.3f (esperado ~5.5)\n", p);
    CHECK(fabsf(p - 5.5f) < 0.03f);
    // POS periódicos (~cada 250 ms) y uno final moving=0
    for (auto& mm : sink.out) if (mm.slot==0 && startsWith(mm.line,"POS ")) posMsgs++;
    printf("POS enviados a slot0: %d\n", posMsgs);
    CHECK(posMsgs >= 4 && posMsgs <= 7);
    int mv=-1; lastPos(sink,0,&mv); CHECK(mv==0);

    // 5) Clamp en el final y en el inicio
    sink.clear(); t += 10; m.motionStart(+1, t);
    for (uint32_t end=t+30000; t<end; t+=5) m.update(t);   // se suelta mucho después: topa
    m.motionStop(); for (uint32_t end=t+400; t<end; t+=5) m.update(t);
    m.getSongPos("songA.x1", p); CHECK(p==40.0f);
    m.motionStart(-1, t); for (uint32_t end=t+60000; t<end; t+=5) m.update(t);
    m.motionStop(); for (uint32_t end=t+400; t<end; t+=5) m.update(t);
    m.getSongPos("songA.x1", p); CHECK(p==0.0f);

    // 6) HOME / END
    sink.clear(); m.goEnd(); m.getSongPos("songA.x1", p); CHECK(p==40.0f); CHECK(lastPos(sink,0)==40.0f && lastPos(sink,1)==40.0f);
    m.goHome(); m.getSongPos("songA.x1", p); CHECK(p==0.0f);

    // 7) Dos canciones distintas se mueven a la vez, cada una con su total
    m.onClientConnected(2); sink.clear();
    m.onClientLine(2, "HELLO songB.y2 9 4 0");
    CHECK(m.songCount()==2);
    t += 10; m.motionStart(+1, t); for (uint32_t end=t+5000; t<end; t+=5) m.update(t);
    m.motionStop(); for (uint32_t end=t+400; t<end; t+=5) m.update(t);
    float pa, pb; m.getSongPos("songA.x1",pa); m.getSongPos("songB.y2",pb);
    CHECK(pb==4.0f); CHECK(pa>8.0f && pa<12.0f);
    // el slot 2 solo recibe POS de su canción
    for (auto& mm : sink.out) if (mm.slot==2) CHECK(mm.line.find("songB.y2")!=std::string::npos || startsWith(mm.line,"CFG"));
    for (auto& mm : sink.out) if (mm.slot==0) CHECK(mm.line.find("songB.y2")==std::string::npos);

    // 8) LEAVE con otra clave no hace nada; con la propia, libera y poda
    m.onClientLine(2, "LEAVE otra.clave"); CHECK(m.songCount()==2);
    m.onClientLine(2, "LEAVE songB.y2"); CHECK(m.songCount()==1);

    // 9) Cambiar de canción en el mismo cliente poda la anterior
    m.onClientLine(2, "HELLO songB.y2 9 4 0"); m.onClientLine(2, "HELLO songC.z3 9 10 1"); CHECK(m.songCount()==2);
    // 10) Desconexión poda
    m.onClientDisconnected(2); CHECK(m.songCount()==1);

    // 11) Primero en abrir una canción nueva toma SU pos; si todos se van y vuelve, se reinicia
    m.onClientDisconnected(0); m.onClientDisconnected(1); CHECK(m.songCount()==0);
    sink.clear(); m.onClientConnected(3); m.onClientLine(3,"HELLO songA.x1 6 40 12.25");
    CHECK(lastPos(sink,3)==12.25f);

    // 12) Entradas basura: no deben crashear ni crear estado
    const char* bad[] = {"", "HELLO", "HELLO ", "HELLO a", "HELLO a 1 2", "HELLO a x 2 3", "HELLO a 1 0 3",
        "HELLO a 1 70000 3", "HELLO a 1 2 nan", "HELLO a 1 2 3x", "LEAVE", "FOO bar", "   ", "HELLO  \t  ",
        "HELLO aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 2 3"};
    uint8_t before = m.songCount();
    for (auto b : bad) m.onClientLine(4, b);
    CHECK(m.songCount()==before);
    std::string longLine(500,'A'); m.onClientLine(4, longLine.c_str());
    m.onClientLine(200, "HELLO a 1 2 3");   // slot inválido
    m.onClientLine(4, nullptr);
    CHECK(m.songCount()==before);

    // 13) 7 clientes, 7 canciones distintas: no se queda sin lugar
    PedalSyncModel m2; Sink s2; m2.begin(&s2, 2.0f, 150);
    for (int i=0;i<7;i++){ char b[64]; snprintf(b,sizeof b,"HELLO k%d 5 10 0",i); m2.onClientConnected(i); m2.onClientLine(i,b);} CHECK(m2.songCount()==7);
    for (int i=0;i<7;i++){ char b[64]; snprintf(b,sizeof b,"HELLO n%d 5 10 0",i); m2.onClientLine(i,b);} CHECK(m2.songCount()==7);

    // 14) Desborde de tiempo de millis (wrap de uint32)
    PedalSyncModel m3; Sink s3; m3.begin(&s3,2.0f,150); m3.onClientConnected(0); m3.onClientLine(0,"HELLO w 5 100 0");
    uint32_t tw = 0xFFFFFF00u; m3.motionStart(+1, tw); for (int i=0;i<200;i++){ tw += 5; m3.update(tw);} float pw; m3.getSongPos("w",pw);
    printf("pos tras cruzar wrap de millis: %.3f\n", pw); CHECK(pw > 1.5f && pw < 2.1f);


    // 15) REGRESIÓN: el loop real de la ESP32 corre a ~1 ms por vuelta (o con tiempos irregulares).
    //     Antes, a 1 ms la aceleración inicial se tomaba por "frenado completo" y el movimiento
    //     se cancelaba en el primer tick, publicando la posición vieja como final.
    for (int tickMs = 1; tickMs <= 4; tickMs++) {
        PedalSyncModel mr; Sink sr; mr.begin(&sr, 2.0f, 150); mr.onClientConnected(0);
        mr.onClientLine(0, "HELLO r.1 7 40 1.9"); uint32_t tr = 5000; mr.motionStart(+1, tr);
        for (uint32_t end = 7000; tr < end; tr += tickMs) mr.update(tr);
        float pr; mr.getSongPos("r.1", pr); CHECK(mr.isMoving()); CHECK(fabsf(pr - 5.75f) < 0.05f);
        mr.motionStop(); for (uint32_t end = tr + 400; tr < end; tr += tickMs) mr.update(tr);
        mr.getSongPos("r.1", pr); CHECK(!mr.isMoving()); CHECK(fabsf(pr - 5.90f) < 0.05f);
        int mv = -1; for (auto& mm : sr.out) if (startsWith(mm.line,"POS ")) { char k[64]; float q; sscanf(mm.line.c_str(),"POS %63s %f %d",k,&q,&mv); }
        CHECK(mv == 0);
    }
    // loop con tiempos irregulares (0 a 3 ms entre vueltas, con algún bloqueo largo de 40 ms)
    { PedalSyncModel mr; Sink sr; mr.begin(&sr, 2.0f, 150); mr.onClientConnected(0); mr.onClientLine(0, "HELLO r.2 7 40 1.9");
      uint32_t tr = 9000; mr.motionStart(+1, tr); srand(7); int n = 0;
      for (uint32_t end = 11000; tr < end; tr += rand() % 4, n++) { if (n % 400 == 399) tr += 40; mr.update(tr); }
      float pr; mr.getSongPos("r.2", pr); CHECK(mr.isMoving()); CHECK(pr > 5.0f && pr < 6.0f);
      printf("loop irregular: pos tras 2 s = %.2f\n", pr); }
    // soltar antes del primer update no debe dejar el modelo colgado ni mover la posición
    { PedalSyncModel mr; Sink sr; mr.begin(&sr, 2.0f, 150); mr.onClientConnected(0); mr.onClientLine(0, "HELLO r.3 7 40 1.9");
      mr.motionStart(+1, 100); mr.motionStop(); mr.update(101); mr.update(105); float pr; mr.getSongPos("r.3", pr);
      CHECK(!mr.isMoving()); CHECK(pr == 1.9f); }

    printf(fails? "\n%d FALLAS\n":"\nTODO OK\n", fails); return fails?1:0;
}