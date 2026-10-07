#include "WebPages.h"

String WebPages::dashboard(
    bool apMode,
    bool wifiConnected,
    bool bluetoothEnabled,
    bool bluetoothConnected,
    bool tcpEnabled,
    uint8_t tcpClients,
    const String& ip,
    const String& ssid,
    unsigned long doubleWindow,
    unsigned long holdThreshold,
    unsigned long wifiResetHold
) {
    String page;
    page.reserve(11000);

    page += R"rawliteral(
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pedal Cancionero</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0b0b;color:#f5f5f5}
main{max-width:760px;margin:auto;padding:20px}
.card{background:#181818;border:1px solid #2b2b2b;border-radius:16px;padding:18px;margin-bottom:16px}
h1,h2{margin-top:0}
.muted{color:#999}
.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #292929}
.row:last-child{border-bottom:0}
.badge{padding:5px 9px;border-radius:999px;background:#292929;font-size:13px}
.ok{color:#4ade80}
.off{color:#aaa}
input{width:100%;padding:12px;border-radius:10px;border:1px solid #444;background:#222;color:#fff;font-size:16px}
button{border:0;border-radius:10px;padding:11px 15px;background:#3b82f6;color:#fff;font-size:15px;cursor:pointer}
button.secondary{background:#333}
button.danger{background:#7f1d1d}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
label{display:block;margin:14px 0 6px}
.network{padding:10px;border-radius:9px;background:#242424;margin-top:7px;cursor:pointer}
small{color:#888}
.switch{position:relative;width:48px;height:27px}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;inset:0;background:#444;border-radius:30px;cursor:pointer}
.slider:before{content:"";position:absolute;width:21px;height:21px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.15s}
.switch input:checked+.slider{background:#2563eb}
.switch input:checked+.slider:before{transform:translateX(21px)}
</style>
</head>
<body>
<main>
<div class="card">
<h1>Pedal Cancionero</h1>
<p class="muted">Configuración del pedal y sus conexiones.</p>
<div class="row"><span>WiFi</span><span id="wifi" class="badge">...</span></div>
<div class="row"><span>Bluetooth</span><span id="ble" class="badge">...</span></div>
<div class="row"><span>Servidor TCP</span><span id="tcp" class="badge">...</span></div>
<div class="row"><span>Clientes TCP</span><span id="clients" class="badge">0</span></div>
<div class="row"><span>IP</span><span class="badge">)rawliteral";
    page += ip;
    page += R"rawliteral(</span></div>
<div class="row"><span>SSID</span><span class="badge">)rawliteral";
    page += ssid.isEmpty() ? "-" : ssid;
    page += R"rawliteral(</span></div>
</div>

<div class="card">
<h2>Conexiones</h2>

<div class="row">
<span>Bluetooth HID</span>
<label class="switch">
<input id="bleToggle" type="checkbox" )rawliteral";
    if (bluetoothEnabled) page += "checked";
    page += R"rawliteral( onchange="saveConnection()">
<span class="slider"></span>
</label>
</div>

<div class="row">
<span>Servidor TCP / eventos</span>
<label class="switch">
<input id="tcpToggle" type="checkbox" )rawliteral";
    if (tcpEnabled) page += "checked";
    page += R"rawliteral( onchange="saveConnection()">
<span class="slider"></span>
</label>
</div>

<p class="muted"><small>Bluetooth y TCP pueden funcionar al mismo tiempo.</small></p>
</div>

<div class="card">
<h2>WiFi</h2>
<label>Red</label>
<input id="ssid" value=")rawliteral";
    String escapedSSID = ssid;
    escapedSSID.replace("&","&amp;");
    escapedSSID.replace("\"","&quot;");
    escapedSSID.replace("<","&lt;");
    escapedSSID.replace(">","&gt;");
    page += escapedSSID;
    page += R"rawliteral(">

<label>Contraseña</label>
<input id="pass" type="password" placeholder="Dejar vacío para mantener la actual">

<div class="actions">
<button onclick="saveWifi()">Guardar y reiniciar</button>
<button class="secondary" onclick="scan()">Buscar redes</button>
</div>
<div id="networks"></div>
</div>

<div class="card">
<h2>Comportamiento</h2>

<label>Ventana de doble toque (ms)</label>
<input id="doubleWindow" type="number" min="150" max="1500" value=")rawliteral";
    page += String(doubleWindow);
    page += R"rawliteral(">

<label>Tiempo para comenzar scroll (ms)</label>
<input id="holdThreshold" type="number" min="150" max="3000" value=")rawliteral";
    page += String(holdThreshold);
    page += R"rawliteral(">

<label>Tiempo de reset WiFi (ms)</label>
<input id="wifiResetHold" type="number" min="1000" max="10000" value=")rawliteral";
    page += String(wifiResetHold);
    page += R"rawliteral(">

<div class="actions">
<button onclick="saveTiming()">Guardar comportamiento</button>
<button class="secondary" onclick="resetConfig()">Restaurar valores</button>
</div>
</div>

<div class="card">
<h2>Sistema</h2>
<div class="actions">
<button class="danger" onclick="resetWifi()">Borrar WiFi y reiniciar</button>
<button class="secondary" onclick="restart()">Reiniciar</button>
</div>
</div>

<div class="card">
<p class="muted">Más adelante, esta misma interfaz puede incorporar el afinador.</p>
</div>
</main>

<script>
async function post(url,data={}) {
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  if(!r.ok) throw new Error(await r.text());
  return r;
}
async function saveConnection(){
  try{
    await post("/api/config",{bluetoothEnabled:document.getElementById("bleToggle").checked,
                              tcpEnabled:document.getElementById("tcpToggle").checked});
    location.reload();
  }catch(e){alert(e.message)}
}
async function saveTiming(){
  try{
    await post("/api/config",{doublePressWindowMs:Number(document.getElementById("doubleWindow").value),
                              holdThresholdMs:Number(document.getElementById("holdThreshold").value),
                              wifiResetHoldMs:Number(document.getElementById("wifiResetHold").value)});
    alert("Configuración guardada");
  }catch(e){alert(e.message)}
}
async function saveWifi(){
  try{
    await post("/api/wifi/save",{ssid:document.getElementById("ssid").value,
                                 pass:document.getElementById("pass").value});
    alert("Guardado. El pedal se reiniciará.");
  }catch(e){alert(e.message)}
}
async function scan(){
  const box=document.getElementById("networks");
  box.innerHTML="Buscando...";
  try{
    const r=await fetch("/api/wifi/scan");
    const list=await r.json();
    box.innerHTML="";
    list.forEach(s=>{
      const d=document.createElement("div");
      d.className="network";
      d.textContent=s;
      d.onclick=()=>document.getElementById("ssid").value=s;
      box.appendChild(d);
    });
    if(!list.length) box.innerHTML="<p class='muted'>No se encontraron redes.</p>";
  }catch(e){box.textContent=e.message}
}
async function resetConfig(){
  if(confirm("¿Restaurar toda la configuración del pedal?")){
    await post("/api/config/reset");
    location.reload();
  }
}
async function resetWifi(){
  if(confirm("¿Borrar las credenciales WiFi y reiniciar?")){
    await post("/api/wifi/reset");
  }
}
async function restart(){
  await post("/api/system/restart");
}
async function refresh(){
  try{
    const r=await fetch("/api/status");
    const s=await r.json();
    const set=(id,text,ok)=>{
      const e=document.getElementById(id);
      e.textContent=text;
      e.className="badge "+(ok?"ok":"off");
    };
    set("wifi",s.wifiConnected?"Conectado":(s.apMode?"Modo AP":"Desconectado"),s.wifiConnected||s.apMode);
    set("ble",s.bluetoothConnected?"Conectado":(s.bluetoothEnabled?"Activado":"Desactivado"),s.bluetoothConnected||s.bluetoothEnabled);
    set("tcp",s.tcpEnabled?"Activado":"Desactivado",s.tcpEnabled);
    document.getElementById("clients").textContent=s.tcpClients;
  }catch(e){}
}
refresh();
setInterval(refresh,2000);
</script>
</body>
</html>
)rawliteral";

    return page;
}

String WebPages::savedPage() {
    return R"rawliteral(
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pedal Cancionero</title>
<style>
body{font-family:system-ui;background:#0b0b0b;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#181818;padding:30px;border-radius:16px;max-width:440px;text-align:center}
</style>
</head>
<body><div class="card">
<h1>Configuración guardada</h1>
<p>El pedal se reiniciará e intentará conectarse a la red WiFi.</p>
</div></body>
</html>
)rawliteral";
}

String WebPages::jsonStatus(
    bool apMode,
    bool wifiConnected,
    bool bluetoothEnabled,
    bool bluetoothConnected,
    bool tcpEnabled,
    uint8_t tcpClients,
    const String& ip,
    const String& ssid
) {
    String json = "{";

    json += "\"apMode\":";
    json += apMode ? "true" : "false";

    json += ",\"wifiConnected\":";
    json += wifiConnected ? "true" : "false";

    json += ",\"bluetoothEnabled\":";
    json += bluetoothEnabled ? "true" : "false";

    json += ",\"bluetoothConnected\":";
    json += bluetoothConnected ? "true" : "false";

    json += ",\"tcpEnabled\":";
    json += tcpEnabled ? "true" : "false";

    json += ",\"tcpClients\":";
    json += String(tcpClients);

    json += ",\"ip\":\"";
    json += ip;
    json += "\"";

    json += ",\"ssid\":\"";
    String safeSSID = ssid;
    safeSSID.replace("\\", "\\\\");
    safeSSID.replace("\"", "\\\"");
    json += safeSSID;
    json += "\"}";

    return json;
}
