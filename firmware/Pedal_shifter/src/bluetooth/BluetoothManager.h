#pragma once

#include <Arduino.h>
#include <BleKeyboard.h>

class PedalConfig;

class BluetoothManager {
public:
    void begin(PedalConfig& config);
    void update();

    void setEnabled(bool enabled);
    bool isEnabled() const;
    bool isConnected();

    void press(char key);
    void release(char key);
    void write(char key);

private:
    PedalConfig* config_ = nullptr;
    BleKeyboard keyboard_{"Pedal Cancionero", "Giovi", 100};
};
