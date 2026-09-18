#include <BleKeyboard.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiServer.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WiFiUdp.h>
#include <Preferences.h>

// ============================================================
// Pines
// ============================================================

const int PIN_SCROLL_UP   = 17;   // Botón Scroll Up (LOW = presionado)
const int PIN_SCROLL_DOWN = 18;   // Botón Scroll Down (LOW = presionado)
const int PIN_STATUS_LED  = 16;   // LED de estado
const int PIN_MODE_SEL    = 4;    // LOW = Bluetooth / HIGH = Socket WiFi


// ============================================================
// Constantes
// ============================================================

const uint16_t SOCKET_PORT = 8080;

const char* AP_SSID = "PedalConfig_wifi";
const char* AP_PASS = "config1234";

const char* MDNS_HOSTNAME = "pedalshifter";
const char* MDNS_SERVICE  = "_pedal";

const uint16_t UDP_BCAST_PORT = 4444;
const unsigned long BCAST_INTERVAL_MS = 3000;


// ============================================================
// Reset WiFi
// ============================================================

const unsigned long WIFI_RESET_HOLD_MS = 3000;


// ============================================================
// Objetos globales
// ============================================================

BleKeyboard bleKeyboard("Pedal Cancionero", "Giovi", 100);

Preferences prefs;

WiFiServer socketServer(SOCKET_PORT);
WebServer httpServer(80);
DNSServer dnsServer;
WiFiUDP udp;


// ============================================================
// Estado general
// ============================================================

bool useSocketMode = false;
bool socketConnected = false;
bool mdnsStarted = false;
bool apMode = false;

unsigned long lastBcast = 0;

unsigned long lastModeCheck = 0;
const unsigned long MODE_DEBOUNCE_MS = 50;


// ============================================================
// Botones
// ============================================================

bool btnUpPressed = false;
bool btnDownPressed = false;

bool doublePressActive = false;
unsigned long doublePressStart = 0;


// ------------------------------------------------------------
// Combinación UP + DOWN para reset WiFi
// ------------------------------------------------------------

bool bothButtonsActive = false;
unsigned long bothButtonsStart = 0;

unsigned long lastWifiResetLed = 0;
bool wifiResetLedState = LOW;


// ============================================================
// Debounce
// ============================================================

unsigned long lastDebounceTimeUp = 0;
unsigned long lastDebounceTimeDown = 0;

bool lastRawUp = HIGH;
bool lastRawDown = HIGH;

bool debouncedUp = HIGH;
bool debouncedDown = HIGH;

const unsigned long DEBOUNCE_DELAY = 50;


// ============================================================
// LED
// ============================================================

unsigned long lastLedBlink = 0;
bool ledState = LOW;


// ============================================================
// Preferences — WiFi
// ============================================================

String getStoredSSID()
{
    prefs.begin("wifi", true);

    String ssid = prefs.getString("ssid", "");

    prefs.end();

    return ssid;
}


String getStoredPass()
{
    prefs.begin("wifi", true);

    String pass = prefs.getString("pass", "");

    prefs.end();

    return pass;
}


void storeCredentials(const String& ssid, const String& pass)
{
    Serial.println("[WiFi] Guardando credenciales...");

    prefs.begin("wifi", false);

    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);

    prefs.end();

    Serial.println("[WiFi] Credenciales guardadas correctamente");
}


void clearCredentials()
{
    Serial.println();
    Serial.println("[WiFi] =================================");
    Serial.println("[WiFi] BORRANDO CREDENCIALES WIFI");
    Serial.println("[WiFi] =================================");

    prefs.begin("wifi", false);

    prefs.clear();

    prefs.end();

    Serial.println("[WiFi] Credenciales eliminadas correctamente");
}


// ============================================================
// Página HTML
// ============================================================

const char CONFIG_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1">

<meta name="theme-color"
      content="#111111">

<title>Pedal Cancionero - WiFi</title>

<style>

body {
    font-family: Arial, sans-serif;
    background: #111;
    color: #fff;
    margin: 0;
    padding: 20px;
}

.container {
    max-width: 500px;
    margin: auto;
}

h1 {
    font-size: 24px;
    margin-bottom: 5px;
}

p {
    color: #aaa;
}

.card {
    background: #1d1d1d;
    border-radius: 12px;
    padding: 20px;
    margin-top: 20px;
}

label {
    display: block;
    margin-top: 15px;
    margin-bottom: 5px;
}

input {
    box-sizing: border-box;
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: #292929;
    color: white;
    font-size: 16px;
}

button {
    width: 100%;
    padding: 13px;
    margin-top: 20px;
    border: none;
    border-radius: 8px;
    background: #3b82f6;
    color: white;
    font-size: 16px;
    cursor: pointer;
}

button:disabled {
    opacity: 0.5;
}

.network {
    padding: 12px;
    margin-top: 8px;
    background: #292929;
    border-radius: 8px;
    cursor: pointer;
}

.network:hover {
    background: #383838;
}

.status {
    margin-top: 15px;
    color: #aaa;
}

</style>

</head>


<body>

<div class="container">

    <h1>🎵 Pedal Cancionero</h1>

    <p>Configuración de WiFi</p>


    <div class="card">

        <form method="POST" action="/save">

            <label for="ssid">
                Red WiFi
            </label>

            <input
                type="text"
                id="ssid"
                name="ssid"
                required
                autocomplete="off"
            >


            <label for="pass">
                Contraseña
            </label>

            <input
                type="password"
                id="pass"
                name="pass"
                autocomplete="off"
            >


            <button type="submit">
                Guardar y reiniciar
            </button>

        </form>

    </div>


    <div class="card">

        <h3>Redes disponibles</h3>

        <button
            type="button"
            onclick="scanNetworks()"
        >
            Buscar redes
        </button>

        <div id="networks" class="status">
            Buscando redes...
        </div>

    </div>

</div>


<script>

async function scanNetworks()
{
    const container =
        document.getElementById("networks");

    container.innerHTML =
        "Buscando redes...";

    try
    {
        const response =
            await fetch("/scan");

        if (!response.ok)
        {
            throw new Error("Error HTTP");
        }

        const networks =
            await response.json();

        container.innerHTML = "";


        if (networks.length === 0)
        {
            container.innerHTML =
                "No se encontraron redes.";

            return;
        }


        networks.forEach(function(ssid)
        {
            const div =
                document.createElement("div");

            div.className = "network";

            div.textContent = ssid;

            div.onclick = function()
            {
                document.getElementById("ssid").value =
                    ssid;
            };

            container.appendChild(div);
        });
    }
    catch(error)
    {
        container.innerHTML =
            "No se pudieron buscar las redes.";
    }
}


window.addEventListener(
    "load",
    scanNetworks
);

</script>

</body>

</html>
)rawliteral";


// ============================================================
// Página de confirmación
// ============================================================

const char SAVED_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta name="viewport"
      content="width=device-width, initial-scale=1">

<title>Pedal Cancionero</title>

<style>

body {
    font-family: Arial, sans-serif;
    background: #111;
    color: white;
    text-align: center;
    padding: 40px 20px;
}

.card {
    max-width: 450px;
    margin: auto;
    background: #1d1d1d;
    border-radius: 12px;
    padding: 30px;
}

</style>

</head>

<body>

<div class="card">

<h1>✅ Configuración guardada</h1>

<p>
Las credenciales fueron guardadas correctamente.
</p>

<p>
El pedal se está reiniciando...
</p>

<p>
Esperá unos segundos.
</p>

</div>

</body>

</html>
)rawliteral";


// ============================================================
// Captive Portal
// ============================================================

void handleCaptivePortal()
{
    Serial.print("[HTTP] Captive portal request: ");
    Serial.println(httpServer.uri());

    httpServer.sendHeader(
        "Location",
        "http://" + WiFi.softAPIP().toString() + "/",
        true
    );

    httpServer.send(
        302,
        "text/plain",
        "Redireccionando al portal..."
    );
}


// ============================================================
// Iniciar Access Point
// ============================================================

void startAP()
{
    Serial.println();
    Serial.println("=================================");
    Serial.println("[WiFi] INICIANDO CAPTIVE PORTAL");
    Serial.println("=================================");


    apMode = true;

    socketConnected = false;


    // --------------------------------------------------------
    // Configurar AP
    // --------------------------------------------------------

    WiFi.mode(WIFI_AP);

    bool result =
        WiFi.softAP(
            AP_SSID,
            AP_PASS
        );


    if (!result)
    {
        Serial.println(
            "[AP] ERROR iniciando Access Point"
        );

        return;
    }


    IPAddress ip =
        WiFi.softAPIP();


    Serial.print("[AP] SSID: ");
    Serial.println(AP_SSID);

    Serial.print("[AP] Password: ");
    Serial.println(AP_PASS);

    Serial.print("[AP] IP: ");
    Serial.println(ip);


    // --------------------------------------------------------
    // DNS
    // --------------------------------------------------------

    dnsServer.start(
        53,
        "*",
        ip
    );


    Serial.println(
        "[DNS] Captive DNS iniciado"
    );


    // --------------------------------------------------------
    // Página principal
    // --------------------------------------------------------

    httpServer.on(
        "/",
        HTTP_GET,
        []()
        {
            httpServer.send(
                200,
                "text/html",
                CONFIG_PAGE
            );
        }
    );


    // --------------------------------------------------------
    // Endpoint de scan
    // --------------------------------------------------------

    httpServer.on(
        "/scan",
        HTTP_GET,
        []()
        {
            Serial.println(
                "[WiFi] Escaneando redes..."
            );


            int n =
                WiFi.scanNetworks(
                    false,
                    true
                );


            String json = "[";


            for (int i = 0; i < n; i++)
            {
                String ssid =
                    WiFi.SSID(i);


                if (ssid.length() == 0)
                    continue;


                // Escapar comillas
                ssid.replace(
                    "\\",
                    "\\\\"
                );

                ssid.replace(
                    "\"",
                    "\\\""
                );


                if (json.length() > 1)
                    json += ",";


                json += "\"";
                json += ssid;
                json += "\"";
            }


            json += "]";


            WiFi.scanDelete();


            httpServer.send(
                200,
                "application/json",
                json
            );


            Serial.println(
                "[WiFi] Scan terminado"
            );
        }
    );


    // --------------------------------------------------------
    // Guardar credenciales
    // --------------------------------------------------------

    httpServer.on(
        "/save",
        HTTP_POST,
        []()
        {
            Serial.println();
            Serial.println(
                "[HTTP] POST /save recibido"
            );


            if (
                !httpServer.hasArg("ssid") ||
                !httpServer.hasArg("pass")
            )
            {
                Serial.println(
                    "[HTTP] Faltan parametros"
                );


                httpServer.send(
                    400,
                    "text/plain",
                    "Faltan parametros"
                );

                return;
            }


            String ssid =
                httpServer.arg("ssid");


            String pass =
                httpServer.arg("pass");


            ssid.trim();


            Serial.print(
                "[WiFi] SSID recibido: "
            );

            Serial.println(ssid);


            Serial.print(
                "[WiFi] Password recibido: "
            );

            Serial.println(
                pass.length() > 0
                    ? "(recibido)"
                    : "(vacio)"
            );


            if (ssid.length() == 0)
            {
                httpServer.send(
                    400,
                    "text/plain",
                    "SSID vacio"
                );

                return;
            }


            // ------------------------------------------------
            // Guardar
            // ------------------------------------------------

            storeCredentials(
                ssid,
                pass
            );


            // ------------------------------------------------
            // Responder ANTES de reiniciar
            // ------------------------------------------------

            httpServer.send(
                200,
                "text/html",
                SAVED_PAGE
            );


            Serial.println(
                "[WiFi] Reiniciando en 2 segundos..."
            );


            delay(2000);

            ESP.restart();
        }
    );


    // --------------------------------------------------------
    // Android captive portal
    // --------------------------------------------------------

    httpServer.on(
        "/generate_204",
        HTTP_GET,
        []()
        {
            httpServer.send(
                200,
                "text/html",
                CONFIG_PAGE
            );
        }
    );


    // --------------------------------------------------------
    // Android / Chrome
    // --------------------------------------------------------

    httpServer.on(
        "/gen_204",
        HTTP_GET,
        []()
        {
            httpServer.send(
                200,
                "text/html",
                CONFIG_PAGE
            );
        }
    );


    // --------------------------------------------------------
    // Apple captive portal
    // --------------------------------------------------------

    httpServer.on(
        "/hotspot-detect.html",
        HTTP_GET,
        []()
        {
            httpServer.send(
                200,
                "text/html",
                CONFIG_PAGE
            );
        }
    );


    httpServer.on(
        "/library/test/success.html",
        HTTP_GET,
        []()
        {
            httpServer.send(
                200,
                "text/html",
                CONFIG_PAGE
            );
        }
    );


    // --------------------------------------------------------
    // Windows captive portal
    // --------------------------------------------------------

    httpServer.on(
        "/connecttest.txt",
        HTTP_GET,
        []()
        {
            httpServer.send(
                200,
                "text/html",
                CONFIG_PAGE
            );
        }
    );


    httpServer.on(
        "/ncsi.txt",
        HTTP_GET,
        []()
        {
            httpServer.send(
                200,
                "text/html",
                CONFIG_PAGE
            );
        }
    );


    // --------------------------------------------------------
    // Cualquier otra URL
    // --------------------------------------------------------

    httpServer.onNotFound(
        handleCaptivePortal
    );


    // --------------------------------------------------------
    // Arrancar servidor
    // --------------------------------------------------------

    httpServer.begin();


    Serial.println(
        "[HTTP] Servidor iniciado en puerto 80"
    );

    Serial.println();
    Serial.println(
        ">>> Conectate a la red:"
    );

    Serial.println(AP_SSID);

    Serial.println(
        ">>> Password:"
    );

    Serial.println(AP_PASS);

    Serial.println();
    Serial.println(
        ">>> Si no aparece automaticamente,"
    );

    Serial.print(
        ">>> abrir: http://"
    );

    Serial.print(ip);

    Serial.println("/");

    Serial.println();
}


// ============================================================
// Conexión WiFi normal
// ============================================================

void startWiFi()
{
    String ssid =
        getStoredSSID();

    String pass =
        getStoredPass();


    // --------------------------------------------------------
    // No hay credenciales
    // --------------------------------------------------------

    if (ssid.length() == 0)
    {
        Serial.println(
            "[WiFi] No hay credenciales guardadas"
        );

        startAP();

        return;
    }


    // --------------------------------------------------------
    // Intentar conexión
    // --------------------------------------------------------

    Serial.println();
    Serial.println(
        "[WiFi] Intentando conectar..."
    );

    Serial.print(
        "[WiFi] SSID: "
    );

    Serial.println(ssid);


    WiFi.mode(WIFI_STA);


    WiFi.begin(
        ssid.c_str(),
        pass.c_str()
    );


    unsigned long start =
        millis();


    while (
        WiFi.status() != WL_CONNECTED &&
        millis() - start < 15000
    )
    {
        delay(500);

        Serial.print(".");
    }


    // --------------------------------------------------------
    // Conectado
    // --------------------------------------------------------

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println();
        Serial.println(
            "[WiFi] CONECTADO"
        );


        Serial.print(
            "[WiFi] IP: "
        );

        Serial.println(
            WiFi.localIP()
        );


        apMode = false;


        // ----------------------------------------------------
        // mDNS
        // ----------------------------------------------------

        if (
            !MDNS.begin(
                MDNS_HOSTNAME
            )
        )
        {
            Serial.println(
                "[mDNS] Error al iniciar"
            );
        }
        else
        {
            MDNS.addService(
                MDNS_SERVICE,
                "tcp",
                SOCKET_PORT
            );

            mdnsStarted = true;

            Serial.println(
                "[mDNS] pedalshifter.local"
            );
        }


        // ----------------------------------------------------
        // Socket
        // ----------------------------------------------------

        socketServer.begin();

        socketConnected = true;


        Serial.println(
            "[Socket] Servidor iniciado"
        );
    }

    // --------------------------------------------------------
    // Falló conexión
    // --------------------------------------------------------

    else
    {
        Serial.println();
        Serial.println(
            "[WiFi] ERROR: no se pudo conectar"
        );


        WiFi.disconnect(true);

        delay(500);


        Serial.println(
            "[WiFi] Iniciando AP de configuracion..."
        );


        startAP();
    }
}


// ============================================================
// Broadcast UDP
// ============================================================

void broadcastUDP()
{
    IPAddress ip =
        WiFi.localIP();


    char buf[64];


    snprintf(
        buf,
        sizeof(buf),
        "{\"ip\":\"%s\",\"port\":%d}",
        ip.toString().c_str(),
        SOCKET_PORT
    );


    udp.beginPacket(
        "255.255.255.255",
        UDP_BCAST_PORT
    );


    udp.write(
        (uint8_t*)buf,
        strlen(buf)
    );


    udp.endPacket();


    Serial.printf(
        "[UDP] Broadcast: %s\n",
        buf
    );
}


// ============================================================
// Gestión clientes TCP
// ============================================================

const uint8_t MAX_CLIENTS = 7;

WiFiClient clients[MAX_CLIENTS];


void acceptClients()
{
    WiFiClient c =
        socketServer.available();


    if (c)
    {
        for (
            uint8_t i = 0;
            i < MAX_CLIENTS;
            i++
        )
        {
            if (
                !clients[i] ||
                !clients[i].connected()
            )
            {
                clients[i] = c;


                Serial.printf(
                    "[Socket] Cliente %d conectado\n",
                    i
                );


                break;
            }
        }
    }
}


void cleanClients()
{
    for (
        uint8_t i = 0;
        i < MAX_CLIENTS;
        i++
    )
    {
        if (
            clients[i] &&
            !clients[i].connected()
        )
        {
            clients[i].stop();


            Serial.printf(
                "[Socket] Cliente %d desconectado\n",
                i
            );
        }
    }
}


void broadcastEvent(
    const char* msg
)
{
    for (
        uint8_t i = 0;
        i < MAX_CLIENTS;
        i++
    )
    {
        if (
            clients[i] &&
            clients[i].connected()
        )
        {
            clients[i].println(msg);
        }
    }
}


// ============================================================
// Cancelar eventos de botones al comenzar combinación
// ============================================================

void cancelButtonEventsForWifiReset()
{
    // --------------------------------------------------------
    // Si algún botón ya había sido enviado como presionado,
    // enviamos su correspondiente release antes de cancelar.
    // --------------------------------------------------------

    if (btnUpPressed)
    {
        if (
            useSocketMode &&
            socketConnected
        )
        {
            broadcastEvent(
                "UP_RELEASE\n"
            );
        }
        else if (
            bleKeyboard.isConnected()
        )
        {
            bleKeyboard.release('1');
        }

        btnUpPressed = false;
    }


    if (btnDownPressed)
    {
        if (
            useSocketMode &&
            socketConnected
        )
        {
            broadcastEvent(
                "DOWN_RELEASE\n"
            );
        }
        else if (
            bleKeyboard.isConnected()
        )
        {
            bleKeyboard.release('2');
        }

        btnDownPressed = false;
    }
}


// ============================================================
// LED — cuenta regresiva del reset WiFi
// ============================================================

void updateWifiResetLed(unsigned long now)
{
    if (!bothButtonsActive)
        return;


    unsigned long elapsed =
        now - bothButtonsStart;


    // --------------------------------------------------------
    // Último tramo: parpadeo muy rápido
    // --------------------------------------------------------

    unsigned long interval;


    if (elapsed < 1000)
    {
        interval = 500;
    }
    else if (elapsed < 2000)
    {
        interval = 300;
    }
    else
    {
        interval = 120;
    }


    if (
        now - lastWifiResetLed >= interval
    )
    {
        lastWifiResetLed = now;

        wifiResetLedState =
            !wifiResetLedState;

        digitalWrite(
            PIN_STATUS_LED,
            wifiResetLedState
        );
    }
}


// ============================================================
// Ejecutar reset WiFi
// ============================================================

void performWifiReset()
{
    Serial.println();
    Serial.println(
        "[WiFi] ================================="
    );

    Serial.println(
        "[WiFi] RESET DE CREDENCIALES SOLICITADO"
    );

    Serial.println(
        "[WiFi] ================================="
    );


    clearCredentials();


    // --------------------------------------------------------
    // Parpadeo final de confirmación
    // --------------------------------------------------------

    for (int i = 0; i < 3; i++)
    {
        digitalWrite(
            PIN_STATUS_LED,
            HIGH
        );

        delay(100);

        digitalWrite(
            PIN_STATUS_LED,
            LOW
        );

        delay(100);
    }


    Serial.println(
        "[WiFi] Reiniciando..."
    );


    delay(300);

    ESP.restart();
}


// ============================================================
// Setup
// ============================================================

void setup()
{
    Serial.begin(115200);


    Serial.println();
    Serial.println(
        "================================="
    );

    Serial.println(
        "     PEDAL CANCIONERO"
    );

    Serial.println(
        "================================="
    );


    // --------------------------------------------------------
    // Hardware
    // --------------------------------------------------------

    pinMode(
        PIN_SCROLL_UP,
        INPUT_PULLUP
    );

    pinMode(
        PIN_SCROLL_DOWN,
        INPUT_PULLUP
    );

    pinMode(
        PIN_STATUS_LED,
        OUTPUT
    );

    pinMode(
        PIN_MODE_SEL,
        INPUT_PULLUP
    );


    digitalWrite(
        PIN_STATUS_LED,
        LOW
    );


    // --------------------------------------------------------
    // Selector de modo
    // --------------------------------------------------------

    useSocketMode =
        digitalRead(PIN_MODE_SEL) == HIGH;


    // --------------------------------------------------------
    // Bluetooth
    // --------------------------------------------------------

    bleKeyboard.begin();


    // --------------------------------------------------------
    // WiFi
    // --------------------------------------------------------

    if (useSocketMode)
    {
        Serial.println(
            "[Modo] Socket WiFi seleccionado"
        );

        startWiFi();
    }
    else
    {
        Serial.println(
            "[Modo] Bluetooth seleccionado"
        );
    }
}


// ============================================================
// Loop
// ============================================================

void loop()
{
    unsigned long now =
        millis();


    // ========================================================
    // LED
    // ========================================================

    if (bothButtonsActive)
    {
        // ----------------------------------------------------
        // Durante el reset WiFi el LED es controlado por la
        // cuenta regresiva.
        // ----------------------------------------------------

        updateWifiResetLed(now);
    }
    else if (!useSocketMode)
    {
        // ----------------------------------------------------
        // Bluetooth
        // ----------------------------------------------------

        bool isBLE =
            bleKeyboard.isConnected();


        if (!isBLE)
        {
            if (
                now - lastLedBlink >= 500
            )
            {
                lastLedBlink = now;

                ledState = !ledState;

                digitalWrite(
                    PIN_STATUS_LED,
                    ledState
                );
            }
        }
        else
        {
            digitalWrite(
                PIN_STATUS_LED,
                HIGH
            );
        }
    }
    else
    {
        // ----------------------------------------------------
        // WiFi
        // ----------------------------------------------------

        if (!socketConnected)
        {
            if (
                now - lastLedBlink >= 200
            )
            {
                lastLedBlink = now;

                ledState = !ledState;

                digitalWrite(
                    PIN_STATUS_LED,
                    ledState
                );
            }
        }
        else
        {
            digitalWrite(
                PIN_STATUS_LED,
                HIGH
            );
        }
    }


    // ========================================================
    // Cambio de modo
    // ========================================================

    if (
        now - lastModeCheck >=
        MODE_DEBOUNCE_MS
    )
    {
        lastModeCheck = now;


        bool sel =
            digitalRead(PIN_MODE_SEL) == HIGH;


        if (sel != useSocketMode)
        {
            Serial.println(
                "[Modo] Cambio detectado"
            );

            delay(100);

            ESP.restart();
        }
    }


    // ========================================================
    // Debounce botones
    // ========================================================

    bool rawUp =
        digitalRead(PIN_SCROLL_UP);


    bool rawDown =
        digitalRead(PIN_SCROLL_DOWN);


    if (rawUp != lastRawUp)
    {
        lastDebounceTimeUp = now;
    }


    if (rawDown != lastRawDown)
    {
        lastDebounceTimeDown = now;
    }


    if (
        now - lastDebounceTimeUp >
        DEBOUNCE_DELAY
    )
    {
        debouncedUp = rawUp;
    }


    if (
        now - lastDebounceTimeDown >
        DEBOUNCE_DELAY
    )
    {
        debouncedDown = rawDown;
    }


    lastRawUp = rawUp;
    lastRawDown = rawDown;


    // ========================================================
    // Reset de credenciales WiFi
    // UP + DOWN durante 3 segundos
    // ========================================================

    bool bothButtonsPressed =
        debouncedUp == LOW &&
        debouncedDown == LOW;


    // --------------------------------------------------------
    // Inicio de combinación
    // --------------------------------------------------------

    if (
        bothButtonsPressed &&
        !bothButtonsActive
    )
    {
        bothButtonsActive = true;

        bothButtonsStart = now;

        lastWifiResetLed = now;

        wifiResetLedState = LOW;

        digitalWrite(
            PIN_STATUS_LED,
            LOW
        );


        // ----------------------------------------------------
        // La combinación tiene prioridad sobre HOME / END
        // y sobre los eventos normales.
        // ----------------------------------------------------

        doublePressActive = true;


        // ----------------------------------------------------
        // Si algún botón ya había generado un evento,
        // cancelarlo correctamente.
        // ----------------------------------------------------

        cancelButtonEventsForWifiReset();


        Serial.println();
        Serial.println(
            "[WiFi] UP + DOWN detectados"
        );

        Serial.println(
            "[WiFi] Mantener presionados 3 segundos para resetear WiFi..."
        );
    }


    // --------------------------------------------------------
    // Ambos botones siguen presionados
    // --------------------------------------------------------

    if (
        bothButtonsActive &&
        bothButtonsPressed
    )
    {
        if (
            now - bothButtonsStart >=
            WIFI_RESET_HOLD_MS
        )
        {
            performWifiReset();
        }
    }


    // --------------------------------------------------------
    // Se soltó alguno de los botones
    // --------------------------------------------------------

    if (
        !bothButtonsPressed &&
        bothButtonsActive
    )
    {
        bothButtonsActive = false;

        doublePressActive = false;

        wifiResetLedState = LOW;


        Serial.println(
            "[WiFi] Combinación UP + DOWN cancelada"
        );
    }


    // ========================================================
    // Pulsación larga HOME / END
    // ========================================================

    // --------------------------------------------------------
    // IMPORTANTE:
    // No ejecutar esta lógica mientras estamos evaluando
    // la combinación de reset WiFi.
    // --------------------------------------------------------

    if (!bothButtonsActive)
    {
        if (
            (debouncedUp == LOW && !btnUpPressed) ||
            (debouncedDown == LOW && !btnDownPressed)
        )
        {
            doublePressStart = now;

            doublePressActive = false;
        }


        if (
            !doublePressActive &&
            (
                (debouncedUp == LOW && btnUpPressed) ||
                (debouncedDown == LOW && btnDownPressed)
            )
        )
        {
            if (
                now - doublePressStart >= 1500
            )
            {
                doublePressActive = true;


                if (debouncedUp == LOW)
                {
                    Serial.println(
                        "[Evento] HOME"
                    );


                    if (
                        useSocketMode &&
                        socketConnected
                    )
                    {
                        broadcastEvent(
                            "HOME\n"
                        );
                    }
                    else if (
                        bleKeyboard.isConnected()
                    )
                    {
                        bleKeyboard.write('h');
                    }
                }
                else if (debouncedDown == LOW)
                {
                    Serial.println(
                        "[Evento] END"
                    );


                    if (
                        useSocketMode &&
                        socketConnected
                    )
                    {
                        broadcastEvent(
                            "END\n"
                        );
                    }
                    else if (
                        bleKeyboard.isConnected()
                    )
                    {
                        bleKeyboard.write('e');
                    }
                }
            }
        }
    }


    // ========================================================
    // Eventos normales
    // ========================================================

    if (
        !doublePressActive &&
        !bothButtonsActive
    )
    {
        // ----------------------------------------------------
        // UP
        // ----------------------------------------------------

        if (debouncedUp == LOW)
        {
            if (!btnUpPressed)
            {
                btnUpPressed = true;


                Serial.println(
                    "[Boton] UP press"
                );


                if (
                    useSocketMode &&
                    socketConnected
                )
                {
                    broadcastEvent(
                        "UP_PRESS\n"
                    );
                }
                else if (
                    bleKeyboard.isConnected()
                )
                {
                    bleKeyboard.press('1');
                }
            }
        }
        else
        {
            if (btnUpPressed)
            {
                btnUpPressed = false;


                Serial.println(
                    "[Boton] UP release"
                );


                if (
                    useSocketMode &&
                    socketConnected
                )
                {
                    broadcastEvent(
                        "UP_RELEASE\n"
                    );
                }
                else if (
                    bleKeyboard.isConnected()
                )
                {
                    bleKeyboard.release('1');
                }
            }
        }


        // ----------------------------------------------------
        // DOWN
        // ----------------------------------------------------

        if (debouncedDown == LOW)
        {
            if (!btnDownPressed)
            {
                btnDownPressed = true;


                Serial.println(
                    "[Boton] DOWN press"
                );


                if (
                    useSocketMode &&
                    socketConnected
                )
                {
                    broadcastEvent(
                        "DOWN_PRESS\n"
                    );
                }
                else if (
                    bleKeyboard.isConnected()
                )
                {
                    bleKeyboard.press('2');
                }
            }
        }
        else
        {
            if (btnDownPressed)
            {
                btnDownPressed = false;


                Serial.println(
                    "[Boton] DOWN release"
                );


                if (
                    useSocketMode &&
                    socketConnected
                )
                {
                    broadcastEvent(
                        "DOWN_RELEASE\n"
                    );
                }
                else if (
                    bleKeyboard.isConnected()
                )
                {
                    bleKeyboard.release('2');
                }
            }
        }
    }


    // ========================================================
    // Socket
    // ========================================================

    if (
        useSocketMode &&
        socketConnected
    )
    {
        acceptClients();

        cleanClients();


        if (
            now - lastBcast >=
            BCAST_INTERVAL_MS
        )
        {
            lastBcast = now;

            broadcastUDP();
        }
    }


    // ========================================================
    // Captive Portal
    // ========================================================

    if (apMode)
    {
        dnsServer.processNextRequest();

        httpServer.handleClient();
    }
}