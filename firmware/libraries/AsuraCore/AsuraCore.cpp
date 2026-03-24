/*
 * AsuraCore.cpp - Implementation
 */

#include "AsuraCore.h"

// =============================================================================
// STATIC MEMBERS
// =============================================================================

AsuraCore* AsuraCore::_instance = nullptr;
AsuraWriteHandler _asuraWriteHandlers[ASURA_MAX_CHANNELS] = {nullptr};

// =============================================================================
// CONSTRUCTOR
// =============================================================================

AsuraCore::AsuraCore(const char* deviceKey)
  : _deviceKey(deviceKey)
  , _mqttClient(_wifiClient)
  , _lastTelemetry(0)
  , _lastStatus(0)
  , _lastReconnect(0)
  , _telemetryInterval(ASURA_TELEMETRY_INTERVAL)
  , _debug(false)
{
  _instance = this;
  
  for (int i = 0; i < ASURA_MAX_CHANNELS; i++) {
    _channels[i] = 0;
    _channelDirty[i] = false;
    _handlers[i] = nullptr;
  }
  
  // Build topics using device_key
  snprintf(_topicCommand, sizeof(_topicCommand), "device/%s/command", _deviceKey);
  snprintf(_topicStatus, sizeof(_topicStatus), "device/%s/status", _deviceKey);
}

// =============================================================================
// BEGIN
// =============================================================================

void AsuraCore::begin(const char* ssid, const char* password, const char* mqttServer, int mqttPort) {
  _ssid = ssid;
  _password = password;
  _mqttServer = mqttServer;
  _mqttPort = mqttPort;
  
  Serial.println();
  Serial.println("================================================");
  Serial.println("         AsuraCore IoT Platform");
  Serial.println("================================================");
  Serial.println();
  
  // Copy macro-registered handlers
  for (int i = 0; i < ASURA_MAX_CHANNELS; i++) {
    if (_asuraWriteHandlers[i] != nullptr) {
      _handlers[i] = _asuraWriteHandlers[i];
      if (_debug) {
        Serial.print("  Handler registered for channel ");
        Serial.println(i);
      }
    }
  }
  
  _setupWiFi();
  _setupMQTT();
}

// =============================================================================
// RUN (call in loop)
// =============================================================================

void AsuraCore::run() {
  unsigned long now = millis();
  
  // Maintain WiFi
  if (WiFi.status() != WL_CONNECTED) {
    _setupWiFi();
  }
  
  // Maintain MQTT
  if (!_mqttClient.connected()) {
    if (now - _lastReconnect > ASURA_RECONNECT_INTERVAL) {
      _lastReconnect = now;
      _reconnectMQTT();
    }
  } else {
    _mqttClient.loop();
  }
  
  // Send telemetry
  if (now - _lastTelemetry > _telemetryInterval) {
    _lastTelemetry = now;
    _sendTelemetry();
  }
  
  // Send status heartbeat
  if (now - _lastStatus > ASURA_STATUS_INTERVAL) {
    _lastStatus = now;
    _sendStatus("online");
  }
}

// =============================================================================
// WRITE TO CHANNEL (Send data from device to dashboard)
// This uploads telemetry/sensor data to the cloud
// =============================================================================

void AsuraCore::write(int channel, float value) {
  if (channel < 0 || channel >= ASURA_MAX_CHANNELS) return;
  _channels[channel] = value;
  _channelDirty[channel] = true;
}

void AsuraCore::write(int channel, int value) {
  write(channel, (float)value);
}

void AsuraCore::write(int channel, bool value) {
  write(channel, value ? 1.0f : 0.0f);
}

// =============================================================================
// READ CHANNEL (Get cached value from local memory)
// Returns last value received from dashboard or written locally
// =============================================================================

float AsuraCore::read(int channel) {
  if (channel < 0 || channel >= ASURA_MAX_CHANNELS) return 0;
  return _channels[channel];
}

// =============================================================================
// REGISTER HANDLER (Callback when dashboard sends command to this channel)
// =============================================================================

void AsuraCore::onReceive(int channel, AsuraWriteHandler handler) {
  if (channel < 0 || channel >= ASURA_MAX_CHANNELS) return;
  _handlers[channel] = handler;
}

// =============================================================================
// CONNECTION STATUS
// =============================================================================

bool AsuraCore::connected() {
  return _mqttClient.connected();
}

bool AsuraCore::wifiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

// =============================================================================
// SYNC ALL
// =============================================================================

void AsuraCore::syncAll() {
  for (int i = 0; i < ASURA_MAX_CHANNELS; i++) {
    _channelDirty[i] = true;
  }
  _sendTelemetry();
}

// =============================================================================
// SET INTERVAL
// =============================================================================

void AsuraCore::setInterval(unsigned long ms) {
  _telemetryInterval = ms;
}

// =============================================================================
// DEBUG
// =============================================================================

void AsuraCore::setDebug(bool enable) {
  _debug = enable;
}

// =============================================================================
// WIFI SETUP
// =============================================================================

void AsuraCore::_setupWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.print(_ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(_ssid, _password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" FAILED");
  }
}

// =============================================================================
// MQTT SETUP
// =============================================================================

void AsuraCore::_setupMQTT() {
  _mqttClient.setServer(_mqttServer, _mqttPort);
  _mqttClient.setCallback(_mqttCallback);
  _mqttClient.setBufferSize(ASURA_MQTT_BUFFER_SIZE);
}

void AsuraCore::_reconnectMQTT() {
  Serial.print("[MQTT] Connecting...");
  
  String clientId = "asura-";
  clientId += String(random(0xffff), HEX);
  
  // LWT message for offline detection
  char lwtPayload[] = "{\"status\":\"offline\",\"online\":false}";
  
  if (_mqttClient.connect(clientId.c_str(), NULL, NULL,
                          _topicStatus, 0, false, lwtPayload)) {
    Serial.println(" OK");
    _mqttClient.subscribe(_topicCommand);
    Serial.print("[MQTT] Subscribed: ");
    Serial.println(_topicCommand);
    _sendStatus("online");
  } else {
    Serial.print(" FAILED (");
    Serial.print(_mqttClient.state());
    Serial.println(")");
  }
}

// =============================================================================
// MQTT CALLBACK (static)
// =============================================================================

void AsuraCore::_mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (_instance) {
    _instance->_handleMessage(topic, payload, length);
  }
}

// =============================================================================
// HANDLE INCOMING MESSAGE (Command from dashboard)
// Called when dashboard sends a command to control the device
// =============================================================================

void AsuraCore::_handleMessage(char* topic, byte* payload, unsigned int length) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    if (_debug) Serial.println("[MQTT] JSON parse error");
    return;
  }
  
  if (_debug) {
    Serial.print("[MQTT] Command: ");
    serializeJson(doc, Serial);
    Serial.println();
  }
  
  // Handle channel commands: {"channel": N, "value": X} or {"0": X, "1": Y, ...}
  if (doc.containsKey("channel") && doc.containsKey("value")) {
    int channel = doc["channel"].as<int>();
    float value = doc["value"].as<float>();
    
    if (channel >= 0 && channel < ASURA_MAX_CHANNELS) {
      _channels[channel] = value;
      if (_handlers[channel] != nullptr) {
        AsuraParam param(value);
        _handlers[channel](param);
      }
      if (_debug) {
        Serial.print("[MQTT] Ch");
        Serial.print(channel);
        Serial.print(" = ");
        Serial.println(value);
      }
    }
  } else {
    // Handle {"0": X, "1": Y, ...} format
    for (JsonPair kv : doc.as<JsonObject>()) {
      const char* key = kv.key().c_str();
      
      bool isNumber = true;
      for (int i = 0; key[i] != '\0'; i++) {
        if (key[i] < '0' || key[i] > '9') {
          isNumber = false;
          break;
        }
      }
      
      if (isNumber) {
        int channel = atoi(key);
        float value = kv.value().as<float>();
        
        if (channel >= 0 && channel < ASURA_MAX_CHANNELS) {
          _channels[channel] = value;
          if (_handlers[channel] != nullptr) {
            AsuraParam param(value);
            _handlers[channel](param);
          }
        }
      }
    }
  }
}

// =============================================================================
// SEND TELEMETRY (Upload dirty channels to dashboard)
// This sends data FROM device TO cloud/dashboard
// =============================================================================

void AsuraCore::_sendTelemetry() {
  if (!_mqttClient.connected()) return;
  
  for (int i = 0; i < ASURA_MAX_CHANNELS; i++) {
    if (_channelDirty[i]) {
      char topic[128];
      snprintf(topic, sizeof(topic), "device/%s/data/%d", _deviceKey, i);
      
      JsonDocument doc;
      doc["value"] = _channels[i];
      doc["ts"] = millis();
      
      char payload[128];
      serializeJson(doc, payload);
      
      _mqttClient.publish(topic, payload);
      _channelDirty[i] = false;
      
      if (_debug) {
        Serial.print("[MQTT] Sent ch");
        Serial.print(i);
        Serial.print(" = ");
        Serial.println(_channels[i]);
      }
    }
  }
}

// =============================================================================
// SEND STATUS
// =============================================================================

void AsuraCore::_sendStatus(const char* status) {
  if (!_mqttClient.connected()) return;
  
  JsonDocument doc;
  doc["status"] = status;
  doc["online"] = true;
  doc["uptime"] = millis() / 1000;
  doc["rssi"] = WiFi.RSSI();
  doc["heap"] = ESP.getFreeHeap();
  
  char payload[256];
  serializeJson(doc, payload);
  
  _mqttClient.publish(_topicStatus, payload);
  
  if (_debug) {
    Serial.println("[MQTT] Status: online");
  }
}
