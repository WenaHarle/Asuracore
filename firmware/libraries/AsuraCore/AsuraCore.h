/*
 * AsuraCore.h - IoT Platform Library for ESP32/ESP8266
 * 
 * Simple Blynk-like interface for AsuraCore dashboard
 * 
 * Usage:
 *   #include "AsuraCore.h"
 *   
 *   #define DEVICE_KEY "your_device_key_from_dashboard"
 *   AsuraCore asura(DEVICE_KEY);
 *   
 *   void setup() {
 *     asura.begin(WIFI_SSID, WIFI_PASS, MQTT_SERVER);
 *     
 *     // Register handler for receiving data FROM dashboard
 *     asura.onReceive(10, [](AsuraParam param) {
 *       digitalWrite(LED_PIN, param.asInt());
 *     });
 *   }
 *   
 *   void loop() {
 *     asura.run();
 *     
 *     // Send sensor data TO dashboard
 *     asura.write(0, sensorValue);
 *     
 *     // Read cached value (last received from dashboard)
 *     float lastValue = asura.read(10);
 *   }
 * 
 * API Summary:
 *   - asura.write(ch, val)      : SEND data TO dashboard (upload telemetry)
 *   - asura.read(ch)            : READ cached value (from local memory)
 *   - asura.onReceive(ch, fn)   : HANDLER when dashboard SENDS data to device
 */

#ifndef ASURA_CORE_H
#define ASURA_CORE_H

#include <Arduino.h>
#include <ArduinoJson.h>

#ifdef ESP32
  #include <WiFi.h>
#else
  #include <ESP8266WiFi.h>
#endif

#include <PubSubClient.h>

// =============================================================================
// CONFIGURATION
// =============================================================================

#define ASURA_MAX_CHANNELS 30
#define ASURA_MQTT_BUFFER_SIZE 512
#define ASURA_TELEMETRY_INTERVAL 5000    // 5 seconds default
#define ASURA_STATUS_INTERVAL 30000      // 30 seconds heartbeat
#define ASURA_RECONNECT_INTERVAL 5000

// =============================================================================
// CHANNEL VALUE CLASS (like Blynk's param)
// =============================================================================

class AsuraParam {
public:
  AsuraParam(float val) : _value(val) {}
  
  int asInt() const { return (int)_value; }
  float asFloat() const { return _value; }
  double asDouble() const { return (double)_value; }
  bool asBool() const { return _value > 0; }
  String asString() const { return String(_value); }
  
  operator int() const { return asInt(); }
  operator float() const { return asFloat(); }
  operator bool() const { return asBool(); }
  
private:
  float _value;
};

// =============================================================================
// CHANNEL HANDLER TYPE
// =============================================================================

typedef void (*AsuraWriteHandler)(AsuraParam param);

// =============================================================================
// MAIN ASURACORE CLASS
// =============================================================================

class AsuraCore {
public:
  // Constructor - pass DEVICE_KEY from dashboard (64 char hex string)
  AsuraCore(const char* deviceKey);
  
  // Setup - connect to WiFi and MQTT
  void begin(const char* ssid, const char* password, const char* mqttServer, int mqttPort = 1883);
  
  // Main loop - call this in loop()
  void run();
  
  // Send value to channel (upload to dashboard)
  // Use this to send sensor data from device to cloud
  void write(int channel, float value);
  void write(int channel, int value);
  void write(int channel, bool value);
  
  // Alias for write() - more intuitive naming
  void virtualWrite(int channel, float value) { write(channel, value); }
  void virtualWrite(int channel, int value) { write(channel, value); }
  void virtualWrite(int channel, bool value) { write(channel, value); }
  
  // Read cached channel value (last value received from dashboard or written locally)
  // Note: This reads from local memory, not from server
  float read(int channel);
  
  // Get channel value (alias for read)
  float getValue(int channel) { return read(channel); }
  
  // Register callback when dashboard SENDS data to this channel
  // This is called when device RECEIVES a command from dashboard
  void onReceive(int channel, AsuraWriteHandler handler);
  
  // Alias for backward compatibility
  void onWrite(int channel, AsuraWriteHandler handler) { onReceive(channel, handler); }
  
  // Connection status
  bool connected();
  bool wifiConnected();
  
  // Manual sync - send all channels
  void syncAll();
  
  // Set telemetry interval (ms)
  void setInterval(unsigned long ms);
  
  // Debug mode
  void setDebug(bool enable);
  
private:
  const char* _deviceKey;
  const char* _ssid;
  const char* _password;
  const char* _mqttServer;
  int _mqttPort;
  
  WiFiClient _wifiClient;
  PubSubClient _mqttClient;
  
  float _channels[ASURA_MAX_CHANNELS];
  bool _channelDirty[ASURA_MAX_CHANNELS];
  AsuraWriteHandler _handlers[ASURA_MAX_CHANNELS];
  
  char _topicCommand[128];
  char _topicStatus[128];
  
  unsigned long _lastTelemetry;
  unsigned long _lastStatus;
  unsigned long _lastReconnect;
  unsigned long _telemetryInterval;
  
  bool _debug;
  
  void _setupWiFi();
  void _setupMQTT();
  void _reconnectMQTT();
  void _sendTelemetry();
  void _sendStatus(const char* status);
  void _handleMessage(char* topic, byte* payload, unsigned int length);
  
  static AsuraCore* _instance;
  static void _mqttCallback(char* topic, byte* payload, unsigned int length);
};

// =============================================================================
// MACRO FOR EASY CHANNEL HANDLERS (Legacy - kept for backward compatibility)
// Prefer using asura.onReceive(channel, handler) instead
// =============================================================================

#define ASURA_WRITE(channel) \
  void _asuraWriteHandler##channel(AsuraParam param); \
  struct _AsuraWriteRegistrar##channel { \
    _AsuraWriteRegistrar##channel() { \
      _asuraWriteHandlers[channel] = _asuraWriteHandler##channel; \
    } \
  }; \
  static _AsuraWriteRegistrar##channel _asuraReg##channel; \
  void _asuraWriteHandler##channel(AsuraParam param)

// Alias macro - more intuitive naming
#define ASURA_RECEIVE(channel) ASURA_WRITE(channel)

// Global handler array for macro registration
extern AsuraWriteHandler _asuraWriteHandlers[ASURA_MAX_CHANNELS];

#endif // ASURA_CORE_H
