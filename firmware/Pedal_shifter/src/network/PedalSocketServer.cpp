#include "PedalSocketServer.h"

#include "../config/PedalConfig.h"
#include "../wifi/WiFiManager.h"

void PedalSocketServer::begin(PedalConfig& config, WiFiManager& wifi) {
    config_ = &config;
    wifi_ = &wifi;

    if (!config_->connections().tcpEnabled) {
        Serial.println("[TCP] Servidor desactivado.");
        return;
    }

    if (wifi_->isConnected()) {
        startServer();
    }
}

void PedalSocketServer::update() {
    if (!config_ || !wifi_) {
        return;
    }

    if (!config_->connections().tcpEnabled) {
        if (running_) {
            stopServer();
        }
        return;
    }

    if (!wifi_->isConnected()) {
        if (running_) {
            stopServer();
        }
        return;
    }

    if (!running_) {
        startServer();
    }

    acceptClients();
    cleanClients();

    const unsigned long now = millis();

    if (now - lastBroadcast_ >= DISCOVERY_INTERVAL_MS) {
        lastBroadcast_ = now;
        broadcastDiscovery();
    }
}

void PedalSocketServer::startServer() {
    if (running_ || !wifi_->isConnected()) {
        return;
    }

    server_.begin();
    udp_.begin(UDP_DISCOVERY_PORT);

    running_ = true;

    Serial.printf("[TCP] Servidor iniciado en puerto %u.\n", PORT);
}

void PedalSocketServer::stopServer() {
    for (uint8_t i = 0; i < MAX_CLIENTS; ++i) {
        if (clients_[i]) {
            clients_[i].stop();
        }
    }

    udp_.stop();

    running_ = false;

    Serial.println("[TCP] Servidor detenido.");
}

void PedalSocketServer::setEnabled(bool enabled) {
    if (!config_) {
        return;
    }

    config_->connections().tcpEnabled = enabled;
    config_->save();

    if (!enabled) {
        stopServer();
    } else if (wifi_ && wifi_->isConnected()) {
        startServer();
    }
}

bool PedalSocketServer::isEnabled() const {
    return config_ && config_->connections().tcpEnabled;
}

bool PedalSocketServer::isRunning() const {
    return running_;
}

bool PedalSocketServer::hasClients() {
    return connectedClients() > 0;
}

uint8_t PedalSocketServer::connectedClients() {
    uint8_t count = 0;

    for (uint8_t i = 0; i < MAX_CLIENTS; ++i) {
        if (clients_[i] && clients_[i].connected()) {
            ++count;
        }
    }

    return count;
}

void PedalSocketServer::acceptClients() {
    if (!running_) {
        return;
    }

    WiFiClient newClient = server_.available();

    if (!newClient) {
        return;
    }

    for (uint8_t i = 0; i < MAX_CLIENTS; ++i) {
        if (!clients_[i] || !clients_[i].connected()) {
            if (clients_[i]) {
                clients_[i].stop();
            }

            clients_[i] = newClient;

            Serial.printf("[TCP] Cliente conectado slot %u.\n", i);
            return;
        }
    }

    Serial.println("[TCP] Sin slots disponibles.");
    newClient.stop();
}

void PedalSocketServer::cleanClients() {
    for (uint8_t i = 0; i < MAX_CLIENTS; ++i) {
        if (clients_[i] && !clients_[i].connected()) {
            clients_[i].stop();
            Serial.printf("[TCP] Cliente desconectado slot %u.\n", i);
        }
    }
}

void PedalSocketServer::broadcast(const char* message) {
    if (!running_) {
        return;
    }

    for (uint8_t i = 0; i < MAX_CLIENTS; ++i) {
        if (clients_[i] && clients_[i].connected()) {
            clients_[i].print(message);
        }
    }
}

void PedalSocketServer::broadcastDiscovery() {
    if (!running_ || !wifi_->isConnected()) {
        return;
    }

    const String ip = WiFi.localIP().toString();

    char payload[96];

    snprintf(
        payload,
        sizeof(payload),
        "{\"ip\":\"%s\",\"port\":%u}",
        ip.c_str(),
        PORT
    );

    udp_.beginPacket("255.255.255.255", UDP_DISCOVERY_PORT);
    udp_.write(reinterpret_cast<const uint8_t*>(payload), strlen(payload));
    udp_.endPacket();
}
