#include "PedalSocketServer.h"

#include <string.h>

#include "../config/PedalConfig.h"
#include "../diag/PedalDiag.h"
#include "../wifi/WiFiManager.h"

void PedalSocketServer::begin(PedalConfig &config, WiFiManager &wifi) {
  config_ = &config;
  wifi_ = &wifi;

  sync_.begin(this, PedalSyncModel::DEFAULT_LINES_PER_SEC,
              PedalSyncModel::DEFAULT_RAMP_MS);

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
  readClients();

  const unsigned long now = millis();

  sync_.update(static_cast<uint32_t>(now));

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

    rxLen_[i] = 0;
    rxOverflow_[i] = false;
    sync_.onClientDisconnected(i);
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

bool PedalSocketServer::isRunning() const { return running_; }

bool PedalSocketServer::hasClients() { return connectedClients() > 0; }

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

      // Sin Nagle: los eventos del pedal son mensajes chicos y no
      // pueden esperar a juntarse con otros antes de salir.
      clients_[i].setNoDelay(true);

      rxLen_[i] = 0;
      rxOverflow_[i] = false;
      sync_.onClientConnected(i);

      connectedAt_[i] = millis();
      lastRxAt_[i] = 0;
      rxLines_[i] = 0;

      PedalDiag::add(PedalDiag::Cat::TCP, "cliente conectado: slot %u, %s",
                     static_cast<unsigned>(i),
                     clients_[i].remoteIP().toString().c_str());

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

      rxLen_[i] = 0;
      rxOverflow_[i] = false;
      sync_.onClientDisconnected(i);

      PedalDiag::add(
          PedalDiag::Cat::TCP, "cliente desconectado: slot %u (estuvo %lu s)",
          static_cast<unsigned>(i), (millis() - connectedAt_[i]) / 1000UL);

      Serial.printf("[TCP] Cliente desconectado slot %u.\n", i);
    }
  }
}

void PedalSocketServer::broadcast(const char *message) {
  if (!running_) {
    return;
  }

  for (uint8_t i = 0; i < MAX_CLIENTS; ++i) {
    if (clients_[i] && clients_[i].connected()) {
      clients_[i].print(message);
    }
  }
}

void PedalSocketServer::readClients() {
  if (!running_) {
    return;
  }

  for (uint8_t i = 0; i < MAX_CLIENTS; ++i) {
    if (!clients_[i] || !clients_[i].connected()) {
      continue;
    }

    size_t budget = RX_BYTES_PER_UPDATE;

    while (budget > 0 && clients_[i].available() > 0) {
      const int value = clients_[i].read();
      --budget;

      if (value < 0) {
        break;
      }

      const char c = static_cast<char>(value);

      if (c == '\n') {
        if (!rxOverflow_[i] && rxLen_[i] > 0) {
          rx_[i][rxLen_[i]] = '\0';
          lastRxAt_[i] = millis();
          ++rxLines_[i];
          sync_.onClientLine(i, rx_[i]);
        }

        rxLen_[i] = 0;
        rxOverflow_[i] = false;
        continue;
      }

      if (c == '\r') {
        continue;
      }

      if (rxLen_[i] < RX_MAX - 1) {
        rx_[i][rxLen_[i]++] = c;
      } else {
        // Línea demasiado larga: se descarta hasta el próximo '\n'.
        if (!rxOverflow_[i]) {
          PedalDiag::add(PedalDiag::Cat::TCP,
                         "slot %u: línea demasiado larga, se descarta",
                         static_cast<unsigned>(i));
        }

        rxOverflow_[i] = true;
      }
    }
  }
}

void PedalSocketServer::sendToSlot(uint8_t slot, const char *line) {
  if (slot >= MAX_CLIENTS) {
    return;
  }

  if (clients_[slot] && clients_[slot].connected()) {
    clients_[slot].print(line);
  }
}

void PedalSocketServer::log(const char *message) {
  Serial.println(message);

  // El prefijo "[SYNC] " ya lo indica la categoría del registro.
  const char *text = message;
  if (strncmp(text, "[SYNC] ", 7) == 0) {
    text += 7;
  }

  PedalDiag::add(PedalDiag::Cat::SYNC, "%s", text);
}

void PedalSocketServer::syncMotionStart(int8_t dir) {
  if (running_) {
    sync_.motionStart(dir, static_cast<uint32_t>(millis()));
  }
}

void PedalSocketServer::syncMotionStop() {
  if (running_) {
    sync_.motionStop();
  }
}

void PedalSocketServer::syncHome() {
  if (running_) {
    sync_.goHome();
  }
}

void PedalSocketServer::syncEnd() {
  if (running_) {
    sync_.goEnd();
  }
}

void PedalSocketServer::broadcastDiscovery() {
  if (!running_ || !wifi_->isConnected()) {
    return;
  }

  const String ip = WiFi.localIP().toString();

  char payload[96];

  snprintf(payload, sizeof(payload), "{\"ip\":\"%s\",\"port\":%u}", ip.c_str(),
           PORT);

  udp_.beginPacket("255.255.255.255", UDP_DISCOVERY_PORT);
  udp_.write(reinterpret_cast<const uint8_t *>(payload), strlen(payload));
  udp_.endPacket();
}

bool PedalSocketServer::deviceDiag(uint8_t slot, DeviceDiag &out) {
  if (slot >= MAX_CLIENTS || !clients_[slot] || !clients_[slot].connected()) {
    return false;
  }

  const unsigned long now = millis();

  out.slot = slot;

  strncpy(out.ip, clients_[slot].remoteIP().toString().c_str(),
          sizeof(out.ip) - 1);
  out.ip[sizeof(out.ip) - 1] = '\0';

  out.connectedMs = static_cast<uint32_t>(now - connectedAt_[slot]);
  out.everSpoke = rxLines_[slot] > 0;
  out.lastRxMs =
      out.everSpoke ? static_cast<uint32_t>(now - lastRxAt_[slot]) : 0;
  out.rxLines = rxLines_[slot];

  out.hasSong = sync_.clientSong(slot, out.key, out.visible, out.total);

  if (!out.hasSong) {
    out.key[0] = '\0';
    out.visible = 0;
    out.total = 0;
  }

  return true;
}

bool PedalSocketServer::songDiag(uint8_t index, SongDiag &out) const {
  return sync_.songAt(index, out.key, out.pos, out.total, out.clients,
                      out.minVisible);
}

bool PedalSocketServer::motionActive() const { return sync_.isMoving(); }