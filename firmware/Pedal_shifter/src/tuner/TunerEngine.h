#pragma once

// Punto de extensión futuro.
// No se implementa todavía el afinador.
//
// La idea es que este módulo se encargue exclusivamente
// del procesamiento de audio/pitch, sin conocer la interfaz web.
//
// Futuro:
//
//   audio -> TunerEngine -> frecuencia / nota / cents
//
// Luego WebConfigServer podrá exponer esos datos
// mediante una API/WebSocket.

class TunerEngine {
public:
    void begin();
    void update();
};
