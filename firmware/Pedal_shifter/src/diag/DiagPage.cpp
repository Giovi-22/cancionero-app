#include "DiagPage.h"

namespace {

const char PAGE[] PROGMEM = R"rawliteral(<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnóstico · Pedal Cancionero</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0b0b;color:#f5f5f5}
main{max-width:900px;margin:auto;padding:16px}
a{color:#60a5fa;text-decoration:none}
.top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.top h1{font-size:20px;margin:0}
.card{background:#181818;border:1px solid #2b2b2b;border-radius:14px;padding:14px;margin-bottom:14px}
.card h2{font-size:14px;margin:0 0 10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;display:flex;justify-content:space-between;align-items:center}
.muted{color:#8a8a8a}
.small{font-size:12px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#555;margin-right:6px}
.dot.ok{background:#22c55e}.dot.bad{background:#ef4444}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:560px){.grid2{grid-template-columns:1fr}}
.btn{border:1px solid #2f2f2f;background:#1f1f1f;border-radius:12px;padding:12px}
.btn .name{display:flex;justify-content:space-between;align-items:center;font-weight:600}
.led{margin-top:10px;padding:14px 8px;border-radius:10px;text-align:center;font-weight:700;letter-spacing:.5px;background:#262626;color:#777;border:2px solid transparent;transition:background .08s}
.led.on{background:#14532d;color:#86efac}
.led.diff{border-color:#f59e0b}
.kv{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #242424;font-size:13px}
.kv:last-child{border-bottom:0}
.kv b{font-weight:600}
.warn{color:#fbbf24}.bad{color:#f87171}.ok{color:#4ade80}
.banner{background:#422006;border:1px solid #92400e;color:#fcd34d;border-radius:10px;padding:8px 10px;font-size:13px;margin-top:10px}
.dev{border:1px solid #2f2f2f;background:#1f1f1f;border-radius:12px;padding:10px 12px;margin-bottom:8px}
.dev .head{display:flex;justify-content:space-between;gap:8px;font-weight:600}
.pill{display:inline-block;background:#292929;border-radius:999px;padding:2px 8px;font-size:12px;color:#d4d4d4;margin:4px 6px 0 0}
.bar{height:8px;background:#2a2a2a;border-radius:6px;overflow:hidden;margin:8px 0 4px}
.bar i{display:block;height:100%;background:#3b82f6;width:0}
.tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
button{border:0;border-radius:9px;padding:7px 11px;background:#333;color:#fff;font-size:13px;cursor:pointer}
button.on{background:#2563eb}
.chip{background:#262626;color:#aaa;padding:5px 9px}
.chip.on{background:#1e3a8a;color:#dbeafe}
#log{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;height:360px;overflow:auto;background:#101010;border:1px solid #262626;border-radius:10px;padding:6px 8px;margin-top:10px}
.ln{white-space:pre-wrap;word-break:break-word;padding:1px 0}
.ln .t{color:#6b7280}
.ln .c{display:inline-block;min-width:44px;text-align:center;border-radius:5px;padding:0 4px;margin:0 6px;font-size:11px;font-weight:700;color:#0b0b0b}
.c-BTN{background:#f59e0b}.c-EVT{background:#34d399}.c-TCP{background:#60a5fa}.c-SYNC{background:#a78bfa}.c-BLE{background:#22d3ee}.c-WIFI{background:#f472b6}.c-SYS{background:#9ca3af}
.ln.rebote .m{color:#fbbf24}
.ln.evt .m{color:#a7f3d0}
</style>
</head>
<body>
<main>

<div class="top">
<h1>Diagnóstico</h1>
<div><span id="link" class="small"><span class="dot"></span>conectando…</span> · <a href="/">← Configuración</a></div>
</div>

<div class="card">
<h2>Pulsadores <span class="small muted" id="cfgline"></span></h2>
<div class="grid2">
<div class="btn" id="b-up"></div>
<div class="btn" id="b-down"></div>
</div>
<div id="bothbanner" class="banner" style="display:none">UP y DOWN apretados a la vez: la lógica de botones queda en pausa (si se mantienen, se reinicia el WiFi).</div>
<p class="small muted" style="margin:10px 0 0">Apretá cada pulsador: el indicador tiene que cambiar. Si no cambia, la señal no llega al pin (revisá cableado y masa). Muchos "cambios en 10 s" con el pulsador quieto o mantenido indican contacto con rebotes.</p>
</div>

<div class="card">
<h2>Dispositivos conectados <span class="small muted" id="devcount"></span></h2>
<div id="devs"></div>
<div class="kv"><span>Bluetooth</span><b id="ble">-</b></div>
</div>

<div class="card">
<h2>Canciones compartidas <span class="small muted" id="moving"></span></h2>
<div id="songs"></div>
</div>

<div class="card">
<h2>Sistema</h2>
<div id="sys"></div>
</div>

<div class="card">
<h2>Registro de eventos</h2>
<div class="tools">
<span id="chips" class="tools"></span>
<span style="flex:1"></span>
<button id="pause">Pausar</button>
<button id="copy">Copiar</button>
<button id="clear">Limpiar</button>
</div>
<div id="log"></div>
<p class="small muted" style="margin:8px 0 0">Se guardan los últimos 100 eventos en el pedal. Hora = tiempo desde que el pedal arrancó.</p>
</div>

</main>
<script>
(function(){
var CATS=["BTN","EVT","TCP","SYNC","BLE","WIFI","SYS"];
var since=0, busy=false, paused=false, fails=0, rows=[], queue=[], filters={}, lastLogSeq=0;
CATS.forEach(function(c){filters[c]=true;});
var $=function(id){return document.getElementById(id);};

function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function fmtT(ms){var s=Math.floor(ms/1000),m=Math.floor(s/60);return pad(m,2)+":"+pad(s%60,2)+"."+pad(ms%1000,3);}
function pad(n,w){n=String(n);while(n.length<w)n="0"+n;return n;}
function ago(ms){if(ms<1000)return ms+" ms";var s=Math.round(ms/1000);if(s<60)return s+" s";var m=Math.floor(s/60);if(m<60)return m+" min "+(s%60)+" s";return Math.floor(m/60)+" h "+(m%60)+" min";}
function kv(k,v,cls){var d=el("div","kv");d.appendChild(el("span",null,k));d.appendChild(el("b",cls||"",v));return d;}
function clear(n){while(n.firstChild)n.removeChild(n.firstChild);}

function drawBtn(id,label,b){
  var n=$(id);clear(n);
  var name=el("div","name");name.appendChild(el("span",null,label+" · GPIO"+b.pin));
  n.appendChild(name);
  var led=el("div","led"+(b.raw?" on":"")+(b.raw!==b.stable?" diff":""),b.raw?"PRESIONADO":"SUELTO");
  led.title="Nivel del pin ahora mismo. Borde naranja = todavía no pasó el antirrebote.";
  n.appendChild(led);
  n.appendChild(kv("Estado interno",b.state));
  n.appendChild(kv("En ese estado hace",ago(b.stateMs)));
  var many=b.edges10s>=4;
  n.appendChild(kv("Cambios en 10 s",(b.edges10s>=32?"32+":b.edges10s)+(many?"  ⚠":""),many?"warn":""));
  n.appendChild(kv("Cambios totales",String(b.edgesTotal)));
}

function drawDevices(d){
  var box=$("devs");clear(box);
  $("devcount").textContent=d.devices.length+" conectado(s)";
  if(!d.devices.length){box.appendChild(el("p","muted small","Ningún dispositivo conectado por WiFi."));}
  d.devices.forEach(function(x){
    var c=el("div","dev");var h=el("div","head");
    h.appendChild(el("span",null,x.ip));h.appendChild(el("span","muted small","slot "+x.slot));c.appendChild(h);
    c.appendChild(el("span","pill","conectado hace "+ago(x.connectedMs)));
    c.appendChild(el("span","pill",x.spoke?"último mensaje hace "+ago(x.lastRxMs):"todavía no mandó mensajes"));
    c.appendChild(el("span","pill",x.rxLines+" mensajes"));
    var s=el("div","small muted");s.style.marginTop="6px";
    s.textContent=x.hasSong?("Canción: "+x.song+" · pantalla: "+x.visible+" líneas visibles de "+x.total):"Sin canción abierta (la app manda HELLO al abrir una en modo escenario)";
    c.appendChild(s);box.appendChild(c);
  });
  var c=d.conn;
  $("ble").textContent=!c.bleEnabled?"desactivado":(c.bleConnected?"conectado":"esperando conexión");
}

function drawSongs(d){
  var box=$("songs");clear(box);
  $("moving").textContent=d.moving?"● en movimiento":"";
  if(!d.songs.length){box.appendChild(el("p","muted small","No hay canciones abiertas."));}
  d.songs.forEach(function(g){
    var c=el("div","dev");var h=el("div","head");
    h.appendChild(el("span",null,g.key));h.appendChild(el("span",null,g.pos.toFixed(2)+" / "+g.total));c.appendChild(h);
    var bar=el("div","bar");var i=el("i");i.style.width=(g.total?Math.min(100,g.pos/g.total*100):0)+"%";bar.appendChild(i);c.appendChild(bar);
    c.appendChild(el("span","pill",g.clients+" dispositivo(s)"));
    c.appendChild(el("span","pill","pantalla más chica: "+(g.minVisible||"?")+" líneas"));
    box.appendChild(c);
  });
}

function drawSys(d){
  var s=d.sys,c=d.conn,box=$("sys");clear(box);
  box.appendChild(kv("Encendido hace",ago(d.uptimeMs)));
  box.appendChild(kv("RAM libre",Math.round(s.heapFree/1024)+" KB (mínimo "+Math.round(s.heapMin/1024)+" KB)"));
  box.appendChild(kv("WiFi",s.ap?"punto de acceso (configuración)":(s.wifi?("conectado a "+(s.ssid||"-")):"sin conexión")));
  box.appendChild(kv("IP",s.ip||"-"));
  if(s.wifi&&!s.ap)box.appendChild(kv("Señal",s.rssi+" dBm",s.rssi<-80?"warn":""));
  box.appendChild(kv("Servidor TCP",!c.tcpEnabled?"desactivado":(c.tcpRunning?("activo, puerto "+c.port+", "+c.clients+" cliente(s)"):"detenido (sin WiFi)")));
}

function chips(){
  var box=$("chips");clear(box);
  CATS.forEach(function(c){
    var b=el("button","chip"+(filters[c]?" on":""),c);
    b.onclick=function(){filters[c]=!filters[c];chips();renderLog(true);};
    box.appendChild(b);
  });
}

function lineText(r){return "["+fmtT(r.t)+"] "+r.c+"  "+r.m;}

function addRow(r){
  var l=el("div","ln"+(/REBOTE|corte de/.test(r.m)?" rebote":"")+(r.c==="EVT"?" evt":""));
  l.appendChild(el("span","t",fmtT(r.t)));
  l.appendChild(el("span","c c-"+r.c,r.c));
  l.appendChild(el("span","m",r.m));
  return l;
}

function renderLog(full){
  var box=$("log");
  var stick=box.scrollTop+box.clientHeight>=box.scrollHeight-24;
  if(full){clear(box);rows.forEach(function(r){if(filters[r.c])box.appendChild(addRow(r));});}
  else{queue.splice(0).forEach(function(r){rows.push(r);if(filters[r.c])box.appendChild(addRow(r));});}
  while(rows.length>400)rows.shift();
  while(box.childNodes.length>400)box.removeChild(box.firstChild);
  if(stick||full)box.scrollTop=box.scrollHeight;
}

function onData(d){
  fails=0;$("link").innerHTML='<span class="dot ok"></span>en vivo';
  $("cfgline").textContent="antirrebote "+d.cfg.debounceMs+" ms · hold "+d.cfg.holdMs+" ms · doble "+d.cfg.doubleMs+" ms";
  drawBtn("b-up","UP",d.btn.up);drawBtn("b-down","DOWN",d.btn.down);
  $("bothbanner").style.display=d.btn.both?"block":"none";
  drawDevices(d);drawSongs(d);drawSys(d);

  // El pedal se reinició con la página abierta: la secuencia vuelve a empezar.
  if(d.log.seq<lastLogSeq){since=0;rows=[];queue=[];renderLog(true);}
  lastLogSeq=d.log.seq;
  d.log.items.forEach(function(e){queue.push({s:e.s,t:e.t,c:e.c,m:e.m});since=Math.max(since,e.s);});
  if(!d.log.items.length)since=Math.max(since,d.log.seq);
  if(!paused)renderLog(false);
}

function tick(){
  if(busy)return;busy=true;
  fetch("/api/diag?since="+since,{cache:"no-store"}).then(function(r){return r.json();}).then(onData).catch(function(){
    fails++;if(fails>=2)$("link").innerHTML='<span class="dot bad"></span>sin respuesta del pedal';
  }).then(function(){busy=false;});
}

$("pause").onclick=function(){
  paused=!paused;this.textContent=paused?"Reanudar":"Pausar";this.className=paused?"on":"";
  if(!paused)renderLog(false);
};
$("clear").onclick=function(){
  fetch("/api/diag/clear",{method:"POST"}).then(function(r){return r.json();}).then(function(j){since=j.seq;lastLogSeq=j.seq;rows=[];queue=[];renderLog(true);});
};
$("copy").onclick=function(){
  var text=rows.filter(function(r){return filters[r.c];}).map(lineText).join("\n");
  var done=function(){var b=$("copy");b.textContent="Copiado";setTimeout(function(){b.textContent="Copiar";},1200);};
  if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done);return;}
  var t=document.createElement("textarea");t.value=text;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();
  try{document.execCommand("copy");done();}catch(e){}document.body.removeChild(t);
};

chips();tick();setInterval(tick,450);
})();
</script>
</body>
</html>
)rawliteral";

}  // namespace

const char* DiagPage::html() {
    return PAGE;
}
