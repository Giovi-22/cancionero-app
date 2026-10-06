#pragma once

#include <Arduino.h>

class WebPages {
public:
    static String dashboard(
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
    );

    static String savedPage();
    static String jsonStatus(
        bool apMode,
        bool wifiConnected,
        bool bluetoothEnabled,
        bool bluetoothConnected,
        bool tcpEnabled,
        uint8_t tcpClients,
        const String& ip,
        const String& ssid
    );
};
