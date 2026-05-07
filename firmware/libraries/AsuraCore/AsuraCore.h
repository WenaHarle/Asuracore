/*
 * AsuraCore.h - IoT Platform Library for ESP32/ESP8266
 *
 * Simple Blynk-like interface for AsuraCore dashboard
 *
 * ============================================================================
 * QUICK START (cara paling mudah)
 * ============================================================================
 *
 *   #include "AsuraCore.h"
 *
 *   AsuraCore asura("your_device_key");
 *
 *   void setup() {
 *     asura.begin("WiFiName", "WiFiPass", "mqtt.server.com");
 *
 *     // Otomatis kontrol pin lewat dashboard:
 *     asura.bindSwitch(10, RELAY_PIN);          // Switch ch 10 -> Relay
 *     asura.bindSlider(13, LED_PIN, 0, 255);    // Slider ch 13 -> LED PWM
 *
 *     // Otomatis baca pin & kirim ke dashboard:
 *     asura.bindSensor(0, BUTTON_PIN, DIGITAL_INVERTED);
 *     asura.bindSensor(1, POT_PIN, ANALOG_PERCENT);
 *   }
 *
 *   void loop() {
 *     asura.run();   // satu baris ini cukup, semua otomatis!
 *   }
 *
 * ============================================================================
 * ADVANCED API (kalau butuh logika kustom)
 * ============================================================================
 *
 *   asura.write(0, sensorValue);              // Kirim data ke dashboard
 *   asura.read(10);                           // Baca nilai cache lokal
 *   asura.onReceive(10, [](AsuraParam p){     // Handler custom
 *     digitalWrite(LED_PIN, p.asInt());
 *   });
 *
 * API Summary:
 *   - asura.bindSwitch(ch, pin)            : Auto-handle switch widget -> pin
 *   - asura.bindSlider(ch, pin, min, max)  : Auto-handle slider widget -> PWM
 *   - asura.bindSensor(ch, pin, mode)      : Auto-read pin -> kirim ke dashboard
 *   - asura.write(ch, val)                 : SEND data TO dashboard
 *   - asura.read(ch)                       : READ cached value (local memory)
 *   - asura.onReceive(ch, fn)              : HANDLER custom saat dashboard kirim data
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
#define ASURA_MAX_BINDINGS 16
#define ASURA_MQTT_BUFFER_SIZE 512
#define ASURA_TELEMETRY_INTERVAL 5000    // 5 seconds default
#define ASURA_STATUS_INTERVAL 30000      // 30 seconds heartbeat
#define ASURA_RECONNECT_INTERVAL 5000

// =============================================================================
// SENSOR BINDING MODES
// =============================================================================

enum AsuraSensorMode {
  DIGITAL_NORMAL,      // digitalRead langsung (0/1)
  DIGITAL_INVERTED,    // digitalRead dibalik (untuk INPUT_PULLUP)
  ANALOG_RAW,          // analogRead nilai mentah (0-4095 ESP32 / 0-1023 ESP8266)
  ANALOG_PERCENT       // analogRead dipetakan ke 0-100%
};

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
// INTERNAL BINDING STRUCTS
// =============================================================================

struct AsuraSensorBinding {
  int channel;
  int pin;
  AsuraSensorMode mode;
  bool active;
};

struct AsuraSliderBinding {
  int channel;
  int pin;
  int minVal;
  int maxVal;
  bool active;
};

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

  // ---------------------------------------------------------------------------
  // SIMPLE BINDING API (recommended for beginners)
  // ---------------------------------------------------------------------------

  // Bind switch widget (ON/OFF) to a digital output pin.
  // Pin is set OUTPUT automatically. Dashboard switch directly controls pin.
  void bindSwitch(int channel, int pin);

  // Bind slider widget to a PWM pin with auto value mapping.
  // Pin is set OUTPUT automatically. Slider value (minVal..maxVal) is mapped
  // to PWM 0..255.
  void bindSlider(int channel, int pin, int minVal = 0, int maxVal = 255);

  // Bind a sensor pin to a channel. Pin is read automatically every interval
  // and sent to dashboard.
  //   DIGITAL_NORMAL    : pinMode INPUT,        sends digitalRead()
  //   DIGITAL_INVERTED  : pinMode INPUT_PULLUP, sends !digitalRead()
  //   ANALOG_RAW        : sends analogRead() raw value
  //   ANALOG_PERCENT    : sends analogRead() mapped to 0-100
  void bindSensor(int channel, int pin, AsuraSensorMode mode = DIGITAL_NORMAL);

  // ---------------------------------------------------------------------------
  // ADVANCED API
  // ---------------------------------------------------------------------------

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

  // Set telemetry interval (ms) - also controls sensor binding poll rate
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

  // Bindings
  AsuraSensorBinding _sensorBindings[ASURA_MAX_BINDINGS];
  AsuraSliderBinding _sliderBindings[ASURA_MAX_BINDINGS];
  int _switchPins[ASURA_MAX_CHANNELS];   // -1 = no switch bound
  int _numSensorBindings;
  int _numSliderBindings;
  unsigned long _lastSensorRead;

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
  void _pollSensors();
  void _applySwitch(int channel, float value);
  void _applySlider(int channel, float value);
  int _readSensorPin(const AsuraSensorBinding& b);

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
