#include <Arduino.h>

#include "config/PedalConfig.h"
#include "input/PedalButtons.h"
#include "bluetooth/BluetoothManager.h"
#include "wifi/WiFiManager.h"
#include "network/PedalSocketServer.h"
#include "output/PedalEventManager.h"
#include "web/WebConfigServer.h"
#include "hardware/StatusLed.h"

PedalConfig config;
PedalButtons buttons;
BluetoothManager bluetooth;
WiFiManager wifi;
PedalSocketServer socketServer;
PedalEventManager events;
WebConfigServer web;
StatusLed led;

void onPedalEvent(PedalEvent event) {
    events.handle(event);
}

void onWifiReset() {
    events.cancelActivePresses();
    wifi.resetCredentialsAndRestart();
}

void setup() {
    Serial.begin(115200);
    delay(300);

    Serial.println();
    Serial.println("================================");
    Serial.println("       PEDAL CANCIONERO");
    Serial.println("================================");

    config.begin();
    led.begin();

    bluetooth.begin(config);

    wifi.begin(config);

    socketServer.begin(config, wifi);

    events.begin(config, bluetooth, socketServer);

    web.begin(config, wifi, bluetooth, socketServer);

    buttons.begin(config);
    buttons.setEventCallback(onPedalEvent);
    buttons.setWifiResetCallback(onWifiReset);

    Serial.println("[SETUP] Sistema listo.");
}

void loop() {
    const unsigned long now = millis();

    wifi.update();
    socketServer.update();
    web.update();

    buttons.update(now);

    events.update();
    led.update(
        bluetooth.isEnabled() && bluetooth.isConnected(),
        wifi.isConnected(),
        wifi.isApMode(),
        socketServer.isEnabled(),
        socketServer.connectedClients(),
        buttons.bothButtonsActive()
    );
}
