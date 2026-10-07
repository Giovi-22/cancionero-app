#include <BleKeyboard.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiServer.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <WiFiUdp.h>
#include <Preferences.h>

// ---------- Pines ----------
const int PIN_SCROLL_UP   = 17;   // Botón Scroll Up (LOW = presionado)
const int PIN_SCROLL_DOWN = 18;   // Botón Scroll Down (LOW = presionado)
const int PIN_STATUS_LED  = 16;   // LED de estado
const int PIN_MODE_SEL    = 5;    // Selector de modo: LOW = Socket, HIGH = Bluetooth

// ---------- Constantes ----------
const uint16_t SOCKET_PORT       = 8080;                // puerto TCP del servidor
const char*    AP_SSID          = "PedalConfic_wifi"; // AP por defecto (fallback)
const char*    AP_PASS          = "config1234";      // contraseña AP
const char*    MDNS_HOSTNAME    = "pedalshifter";    // nombre .local
const char*    MDNS_SERVICE     = "_pedal";          // _pedal._tcp
const uint16_t UDP_BCAST_PORT   = 4444;               // puerto UDP broadcast
const unsigned long BCAST_INTERVAL_MS = 3000;          // cada 3 s

// ---------- Variables globales ----------
BleKeyboard bleKeyboard("Pedal Cancionero", "Giovi", 100);
Preferences prefs;
WiFiServer socketServer(SOCKET_PORT);
WebServer httpServer(80);
WiFiUDP udp;

bool useSocketMode = false;      // false = Bluetooth, true = Socket
bool socketConnected = false;
bool mdnsStarted = false;
unsigned long lastBcast = 0;
unsigned long lastModeCheck = 0;
const unsigned long MODE_DEBOUNCE_MS = 50;

// ---------- Botón estado ----------
bool btnUpPressed = false;
bool btnDownPressed = false;
bool doublePressActive = false;
unsigned long doublePressStart = 0;
bool ignoreRelease = false;

// ---------- Debounce ----------
unsigned long lastDebounceTimeUp = 0, lastDebounceTimeDown = 0;
bool lastRawUp = HIGH, lastRawDown = HIGH;
bool debouncedUp = HIGH, debouncedDown = HIGH;
const unsigned long DEBOUNCE_DELAY = 50;

// ---------- LED ----------
unsigned long lastLedBlink = 0;
bool ledState = LOW;

// ---------- Helper para Credenciales WiFi ----------
String getStoredSSID(){
    prefs.begin("wifi", true);
    String ssid = prefs.getString("ssid", "");
    prefs.end();
    return ssid;
}
String getStoredPass(){
    prefs.begin("wifi", true);
    String pass = prefs.getString("pass", "");
    prefs.end();
    return pass;
}
void storeCredentials(const String& ssid, const String& pass){
    prefs.begin("wifi", false);
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    prefs.end();
}

// ---------- AP fallback y servidor HTTP ----------
void startAP(){
    Serial.println("[WiFi] Iniciando AP fallback");
    WiFi.softAP(AP_SSID, AP_PASS);
    IPAddress ip = WiFi.softAPIP();
    Serial.print("[AP] IP: "); Serial.println(ip);
    // página de configuración (HTML responsivo)
    httpServer.on("/", HTTP_GET, [](){
        const char* html = R"(
<!DOCTYPE html><html lang='es'><head><meta charset='UTF-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
<title>Config WiFi</title>
<style>body{font-family:Arial,sans-serif;padding:1rem;}input,button{width:100%;margin-top:0.5rem;padding:0.5rem;}.net{border:1px solid #ccc;padding:0.5rem;margin-top:0.5rem;cursor:pointer;}</style>
<script>async function scan(){const r=await fetch('/scan'); const nets=await r.json(); const l=document.getElementById('list'); l.innerHTML=''; nets.forEach(n=>{let d=document.createElement('div');d.className='net';d.textContent=n;d.onclick=()=>{document.getElementById('ssid').value=n;}; l.appendChild(d);});}
window.onload=scan;</script>
<h2>Configura WiFi</h2>
<form method='POST' action='/save'>
<label>SSID:<br><input type='text' name='ssid' id='ssid' required></label>
<label>Contraseña:<br><input type='password' name='pass' required></label>
<button type='submit'>Guardar y reiniciar</button>
</form>
<h3>Redes disponibles</h3><div id='list'></div>
</body></html>
)";
        httpServer.send(200, "text/html", html);
    });
    httpServer.on("/scan", HTTP_GET, [](){
        int n = WiFi.scanNetworks();
        String json = "[";
        for(int i=0;i<n;i++){
            json += "\"" + WiFi.SSID(i) + "\"";
            if(i<n-1) json += ",";
        }
        json += "]";
        httpServer.send(200, "application/json", json);
    });
    httpServer.on("/save", HTTP_POST, [](){
        if(httpServer.hasArg("ssid") && httpServer.hasArg("pass")){
            String ssid = httpServer.arg("ssid");
            String pass = httpServer.arg("pass");
            storeCredentials(ssid, pass);
            httpServer.send(200, "text/plain", "Credenciales guardadas, reiniciando...");
            delay(500);
            ESP.restart();
        } else {
            httpServer.send(400, "text/plain", "Parametros faltantes");
        }
    });
    httpServer.begin();
    Serial.println("[HTTP] Server started (AP mode)");
}

// ---------- Conexión WiFi normal ----------
void startWiFi(){
    String ssid = getStoredSSID();
    String pass = getStoredPass();
    if(ssid.length() == 0){
        Serial.println("[WiFi] No hay credenciales guardadas, usando AP fallback");
        startAP();
        return;
    }
    Serial.printf("[WiFi] Conectando a %s...\n", ssid.c_str());
    WiFi.begin(ssid.c_str(), pass.c_str());
    unsigned long start = millis();
    while(WiFi.status() != WL_CONNECTED && millis() - start < 15000){
        delay(500);
        Serial.print('.');
    }
    if(WiFi.status() == WL_CONNECTED){
        Serial.println("\n[WiFi] Conectado!");
        Serial.print("IP: "); Serial.println(WiFi.localIP());
        // mDNS anuncio
        if(!MDNS.begin(MDNS_HOSTNAME)){
            Serial.println("[mDNS] Error al iniciar");
        } else {
            MDNS.addService(MDNS_SERVICE, "tcp", SOCKET_PORT);
            mdnsStarted = true;
            Serial.println("[mDNS] Service announced: pedalshifter.local");
        }
        socketServer.begin();
        socketConnected = true;
    } else {
        Serial.println("\n[WiFi] Falló conexión, arrancando AP fallback");
        startAP();
    }
}

// ---------- Broadcast UDP de descubrimiento ----------
void broadcastUDP(){
    IPAddress ip = WiFi.localIP();
    char buf[64];
    snprintf(buf, sizeof(buf), "{\"ip\":\"%s\",\"port\":%d}", ip.toString().c_str(), SOCKET_PORT);
    udp.beginPacket("255.255.255.255", UDP_BCAST_PORT);
    udp.write((uint8_t*)buf, strlen(buf));
    udp.endPacket();
    Serial.printf("[UDP] Broadcast: %s\n", buf);
}

// ---------- Gestión de clientes TCP ----------
const uint8_t MAX_CLIENTS = 7;
WiFiClient clients[MAX_CLIENTS];

void acceptClients(){
    WiFiClient c = socketServer.available();
    if(c){
        for(uint8_t i=0;i<MAX_CLIENTS;i++){
            if(!clients[i] || !clients[i].connected()){
                clients[i] = c;
                Serial.printf("[Socket] Cliente %d conectado\n", i);
                break;
            }
        }
    }
}

void cleanClients(){
    for(uint8_t i=0;i<MAX_CLIENTS;i++){
        if(clients[i] && !clients[i].connected()){
            clients[i].stop();
            Serial.printf("[Socket] Cliente %d desconectado\n", i);
        }
    }
}

void broadcastEvent(const char* msg){
    for(uint8_t i=0;i<MAX_CLIENTS;i++){
        if(clients[i] && clients[i].connected()){
            clients[i].println(msg);
        }
    }
}

// ---------- Setup ----------
void setup(){
    Serial.begin(115200);
    Serial.println("[Pedal] Inicializando hardware");
    pinMode(PIN_SCROLL_UP, INPUT_PULLUP);
    pinMode(PIN_SCROLL_DOWN, INPUT_PULLUP);
    pinMode(PIN_STATUS_LED, OUTPUT);
    pinMode(PIN_MODE_SEL, INPUT_PULLUP);
    digitalWrite(PIN_STATUS_LED, LOW);
    // leer selector inicial
    useSocketMode = digitalRead(PIN_MODE_SEL) == LOW; // LOW = modo socket
    bleKeyboard.begin();
    if(useSocketMode){
        Serial.println("[Modo] Socket (WiFi) seleccionado");
        startWiFi();
    } else {
        Serial.println("[Modo] Bluetooth seleccionado");
    }
}

// ---------- Loop ----------
void loop(){
    unsigned long now = millis();
    // ---- LED de estado ----
    if(!useSocketMode){ // Bluetooth mode
        bool isBLE = bleKeyboard.isConnected();
        if(!isBLE){
            if(now - lastLedBlink >= 500){
                lastLedBlink = now;
                ledState = !ledState;
                digitalWrite(PIN_STATUS_LED, ledState);
            }
        } else {
            digitalWrite(PIN_STATUS_LED, HIGH);
        }
    } else { // Socket mode
        if(!socketConnected){
            if(now - lastLedBlink >= 200){
                lastLedBlink = now;
                ledState = !ledState;
                digitalWrite(PIN_STATUS_LED, ledState);
            }
        } else {
            digitalWrite(PIN_STATUS_LED, HIGH);
        }
    }

    // ---- Cambio de modo mediante el selector ----
    if(now - lastModeCheck >= MODE_DEBOUNCE_MS){
        lastModeCheck = now;
        bool sel = digitalRead(PIN_MODE_SEL) == LOW;
        if(sel != useSocketMode){
            Serial.println("[Modo] Cambio detectado, reiniciando...");
            delay(100);
            ESP.restart();
        }
    }

    // ---- Lectura y debounce de botones ----
    bool rawUp = digitalRead(PIN_SCROLL_UP);
    bool rawDown = digitalRead(PIN_SCROLL_DOWN);
    if(rawUp != lastRawUp) lastDebounceTimeUp = now;
    if(rawDown != lastRawDown) lastDebounceTimeDown = now;
    if(now - lastDebounceTimeUp > DEBOUNCE_DELAY) debouncedUp = rawUp;
    if(now - lastDebounceTimeDown > DEBOUNCE_DELAY) debouncedDown = rawDown;
    lastRawUp = rawUp; lastRawDown = rawDown;

    // ---- Doble pulsación (HOME/END) ----
    if((debouncedUp == LOW && !btnUpPressed) || (debouncedDown == LOW && !btnDownPressed)){
        doublePressStart = now; // primer press
        doublePressActive = false;
    }
    // si se mantiene presionado >1.5s
    if(!doublePressActive && ((debouncedUp == LOW && btnUpPressed) || (debouncedDown == LOW && btnDownPressed))){
        if(now - doublePressStart >= 1500){
            doublePressActive = true;
            if(debouncedUp == LOW){
                Serial.println("[Evento] HOME (doble UP)");
                if(useSocketMode && socketConnected) broadcastEvent("HOME\n");
                else if(bleKeyboard.isConnected()) bleKeyboard.write('h');
            } else if(debouncedDown == LOW){
                Serial.println("[Evento] END (doble DOWN)");
                if(useSocketMode && socketConnected) broadcastEvent("END\n");
                else if(bleKeyboard.isConnected()) bleKeyboard.write('e');
            }
        }
    }

    // ---- Eventos normales (scroll) ----
    if(!doublePressActive){
        // UP press/release
        if(debouncedUp == LOW){
            if(!btnUpPressed){
                btnUpPressed = true;
                Serial.println("[Boton] UP press");
                if(useSocketMode && socketConnected) broadcastEvent("UP_PRESS\n");
                else if(bleKeyboard.isConnected()) bleKeyboard.press('1');
            }
        } else {
            if(btnUpPressed){
                btnUpPressed = false;
                Serial.println("[Boton] UP release");
                if(useSocketMode && socketConnected) broadcastEvent("UP_RELEASE\n");
                else if(bleKeyboard.isConnected()) bleKeyboard.release('1');
            }
        }
        // DOWN press/release
        if(debouncedDown == LOW){
            if(!btnDownPressed){
                btnDownPressed = true;
                Serial.println("[Boton] DOWN press");
                if(useSocketMode && socketConnected) broadcastEvent("DOWN_PRESS\n");
                else if(bleKeyboard.isConnected()) bleKeyboard.press('2');
            }
        } else {
            if(btnDownPressed){
                btnDownPressed = false;
                Serial.println("[Boton] DOWN release");
                if(useSocketMode && socketConnected) broadcastEvent("DOWN_RELEASE\n");
                else if(bleKeyboard.isConnected()) bleKeyboard.release('2');
            }
        }
    }

    // ---- Gestión del servidor socket ----
    if(useSocketMode && socketConnected){
        acceptClients();
        cleanClients();
        // broadcast UDP de descubrimiento cada intervalo
        if(now - lastBcast >= BCAST_INTERVAL_MS){
            lastBcast = now;
            broadcastUDP();
        }
        // si está en modo AP fallback, atender HTTP
        if(WiFi.getMode() == WIFI_AP){
            httpServer.handleClient();
        }
    }
}
