# AsuraCore Arduino Library

A Blynk-like Arduino library for the AsuraCore IoT platform.

## Installation

### Arduino IDE
1. Download this library folder
2. Copy to `Documents/Arduino/libraries/`
3. Restart Arduino IDE

### PlatformIO
Add to `platformio.ini`:
```ini
lib_deps =
    https://github.com/your-repo/asuracore-firmware
```

## Quick Start

```cpp
#include "AsuraCore.h"

#define WIFI_SSID     "your-wifi"
#define WIFI_PASSWORD "your-password"
#define MQTT_SERVER   "your-server-ip"
#define DEVICE_KEY    "device-key-from-dashboard"

AsuraCore asura(DEVICE_KEY);

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  
  // Register handler: called when dashboard SENDS data to channel 10
  asura.onReceive(10, [](AsuraParam param) {
    digitalWrite(LED_PIN, param.asBool());
  });
  
  asura.begin(WIFI_SSID, WIFI_PASSWORD, MQTT_SERVER);
}

void loop() {
  asura.run();
  
  // Send sensor data TO dashboard
  asura.write(0, temperature);  // Upload to cloud
  asura.write(1, humidity);
  
  // Read cached value (last received from dashboard)
  float ledState = asura.read(10);
}
```

## API Reference

### Constructor
```cpp
AsuraCore asura(deviceKey);
```

### Setup
```cpp
asura.begin(ssid, password, mqttServer, mqttPort);  // Port defaults to 1883
asura.setDebug(true);      // Enable serial debug output
asura.setInterval(5000);   // Set telemetry interval (ms)
```

### Main Loop
```cpp
asura.run();  // Call this in loop() - handles WiFi, MQTT, callbacks
```

### Send Data TO Dashboard (Upload)
```cpp
asura.write(channel, value);  // float, int, or bool

// Examples:
asura.write(0, 25.5);         // Send temperature to channel 0
asura.write(1, true);         // Send boolean to channel 1
asura.write(2, 1024);         // Send integer to channel 2
```

### Read Cached Value
```cpp
float value = asura.read(channel);  // Get last value from local cache
```

### Receive Data FROM Dashboard (Callback)
```cpp
// Using lambda (recommended)
asura.onReceive(10, [](AsuraParam param) {
  int value = param.asInt();
  bool state = param.asBool();
  float fval = param.asFloat();
  digitalWrite(LED, state);
});

// Or using ASURA_WRITE macro (legacy, for Blynk users)
ASURA_WRITE(10) {
  digitalWrite(LED, param.asBool());
}
```

### Connection Status
```cpp
if (asura.connected()) { ... }      // MQTT connected
if (asura.wifiConnected()) { ... }  // WiFi connected
```

### Sync All Channels
```cpp
asura.syncAll();  // Force send all channel values
```

## API Summary

| Method | Direction | Description |
|--------|-----------|-------------|
| `asura.write(ch, val)` | Device → Dashboard | Send sensor data to cloud |
| `asura.read(ch)` | Local Cache | Read last value from memory |
| `asura.onReceive(ch, fn)` | Dashboard → Device | Handler when receiving command |

## Channel Mapping Guide

| Channel | Usage | Widget |
|---------|-------|--------|
| 0-5 | Sensor data | Gauge, Chart, Single Value |
| 6-9 | Control feedback | Switch, Slider (two-way sync) |
| 10-19 | Relays/outputs | Switch |
| 20-29 | Reserved | Custom |

## Dashboard Widget Setup

### For Reading Sensors:
1. Create **Gauge**, **Chart**, or **Single Value** widget
2. Select the channel your device writes to
3. Device sends: `asura.write(0, temperature)`

### For Control (Switch):
1. Create **Switch** widget
2. Select channel (e.g., 10)
3. Dashboard sends command when user toggles switch
4. Handle with:
```cpp
asura.onReceive(10, [](AsuraParam param) {
  digitalWrite(RELAY, param.asBool());
});
```
5. For feedback: `asura.write(10, relayState)` in loop

### For Control (Slider):
1. Create **Slider** widget  
2. Select channel (e.g., 11)
3. Set Min/Max (e.g., 0-255 for PWM)
4. Handle with:
```cpp
asura.onReceive(11, [](AsuraParam param) {
  analogWrite(PWM_PIN, param.asInt());
});
```

## Two-Way Sync

For control widgets to stay in sync with device state:

```cpp
bool ledState = false;

void setup() {
  // Handle commands from dashboard
  asura.onReceive(10, [](AsuraParam param) {
    ledState = param.asBool();
    digitalWrite(LED_PIN, ledState);
  });
  
  asura.begin(WIFI_SSID, WIFI_PASS, MQTT_SERVER);
}

void loop() {
  asura.run();
  
  // Send state back so widget stays synced
  asura.write(10, ledState);
}
```

## Examples

- `examples/minimal/` - Simplest possible example
- `examples/relay_control/` - 4-channel relay controller
- `examples/sensor_station/` - Multi-sensor weather station
- `widget_test/` - Full widget test with LED control

## Troubleshooting

### WiFi won't connect
- Check SSID and password
- Ensure 2.4GHz network (ESP doesn't support 5GHz)

### MQTT won't connect
- Verify server IP is reachable
- Check device ID and token match dashboard
- Ensure EMQX is running on port 1883

### Commands not received
- Verify channel numbers match between dashboard and code
- Check `ASURA_WRITE()` macro is defined before `setup()`
- Enable debug: `asura.setDebug(true)`

### Values not updating
- Call `asura.run()` in every `loop()` iteration
- Check `asura.write()` is being called with correct channel

## License

MIT License - Free to use in personal and commercial projects.
