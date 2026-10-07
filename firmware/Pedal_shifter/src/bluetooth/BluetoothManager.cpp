#include "BluetoothManager.h"

#include "../config/PedalConfig.h"

void BluetoothManager::begin(PedalConfig& config) {
    config_ = &config;

    if (!config_->connections().bluetoothEnabled) {
        Serial.println("[Bluetooth] Desactivado.");
        return;
    }

    keyboard_.begin();

    Serial.println("[Bluetooth] BLE iniciado.");
}

void BluetoothManager::update() {
}

void BluetoothManager::setEnabled(bool enabled) {
    if (config_->connections().bluetoothEnabled == enabled) {
        return;
    }

    config_->connections().bluetoothEnabled = enabled;
    config_->save();

    if (enabled) {
        keyboard_.begin();
        Serial.println("[Bluetooth] Activado.");
    } else {
        Serial.println("[Bluetooth] Desactivado.");
        keyboard_.releaseAll();
    }
}

bool BluetoothManager::isEnabled() const {
    return config_ && config_->connections().bluetoothEnabled;
}

bool BluetoothManager::isConnected() {
    return isEnabled() && keyboard_.isConnected();
}

void BluetoothManager::press(char key) {
    if (isConnected()) {
        keyboard_.press(key);
    }
}

void BluetoothManager::release(char key) {
    if (isConnected()) {
        keyboard_.release(key);
    }
}

void BluetoothManager::write(char key) {
    if (isConnected()) {
        keyboard_.write(key);
    }
}
