# AsuraCore Firmware

Arduino/PlatformIO firmware for ESP32 and ESP8266 devices to connect to the AsuraCore IoT platform.

## Features

- WiFi connectivity with auto-reconnect
- MQTT communication for telemetry and commands
- Virtual channels (v0-v5) like Blynk
- Status heartbeat and Last Will Testament (LWT)
- Configurable sensors and actuators

## Supported Boards

### ESP32
- ESP32 DevKit V1
- ESP32-C3
- ESP32-S2
- ESP32-S3
- And other ESP32 variants

### ESP8266
- NodeMCU v2/v3
- Wemos D1 Mini
- Wemos D1 Mini Pro
- And other ESP8266 variants

## Quick Start

### Using PlatformIO (Recommended)

1. Install [PlatformIO](https://platformio.org/)
2. Open this folder in VS Code with PlatformIO extension
3. Edit the configuration in the `.ino` file:
   ```cpp
   const char* WIFI_SSID = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* MQTT_SERVER = "YOUR_SERVER_IP";
   const char* DEVICE_ID = "YOUR_DEVICE_ID";
   const char* DEVICE_TOKEN = "YOUR_DEVICE_TOKEN";
   ```
4. Select your board environment from the PlatformIO toolbar
5. Click Upload

### Using Arduino IDE

1. Install the following libraries from Library Manager:
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` by Benoit Blanchon

2. For ESP32:
   - Install ESP32 board support via Boards Manager
   - Open `asuracore_device/asuracore_device.ino`

3. For ESP8266:
   - Install ESP8266 board support via Boards Manager
   - Open `asuracore_esp8266/asuracore_esp8266.ino`

4. Update the configuration constants at the top of the file
5. Select your board and port
6. Upload

## Configuration

### Getting Device Credentials

1. Log into your AsuraCore dashboard
2. Create a new project (or select existing)
3. Create a new device
4. Copy the Device ID and Token from the device details

### Virtual Channels

The firmware supports 6 virtual channels (v0-v5) that map to different data:

| Channel | Default Mapping | Description |
|---------|-----------------|-------------|
| v0 | Analog Input | Analog sensor reading (0-100) |
| v1 | Temperature | Temperature sensor (°C) |
| v2 | Humidity | Humidity sensor (%) |
| v3 | Button | Digital button state (0/1) |
| v4 | RSSI | WiFi signal strength (dBm) |
| v5 | Uptime | Device uptime (seconds) |

Customize the `readSensors()` function to map your actual sensors.

## Commands

Send commands to your device via the dashboard or API. Supported commands:

```json
// Control relay
{"relay": 1}  // Turn on
{"relay": 0}  // Turn off

// Control LED
{"led": 1}
{"led": 0}

// Set PWM value (0-255)
{"pwm": 128}

// Set virtual channel directly
{"setChannel": {"channel": 0, "value": 42.5}}
```

## Customization

### Adding Sensors

Edit the `readSensors()` function to read your sensors:

```cpp
void readSensors() {
  // Example: DHT22 temperature/humidity sensor
  virtualChannels[1] = dht.readTemperature();
  virtualChannels[2] = dht.readHumidity();
  
  // Example: DS18B20 temperature sensor
  sensors.requestTemperatures();
  virtualChannels[1] = sensors.getTempCByIndex(0);
}
```

### Adding Actuators

Add command handlers in `handleCommand()`:

```cpp
void handleCommand(JsonDocument& doc) {
  if (doc.containsKey("servo")) {
    int angle = doc["servo"];
    myServo.write(angle);
  }
}
```

## Pin Mappings

### ESP32 Default Pins
| Function | GPIO |
|----------|------|
| LED | 2 |
| Relay | 4 |
| PWM | 5 |
| Analog | 34 |
| Button | 0 |

### ESP8266 Default Pins
| Function | GPIO | NodeMCU |
|----------|------|---------|
| LED | 2 | D4 |
| Relay | 5 | D1 |
| PWM | 4 | D2 |
| Analog | A0 | A0 |
| Button | 0 | D3 |

## Troubleshooting

### WiFi not connecting
- Check SSID and password
- Ensure 2.4GHz network (5GHz not supported)
- Check signal strength

### MQTT not connecting
- Verify server IP address
- Check if MQTT port 1883 is accessible
- Verify device credentials

### No data showing in dashboard
- Check Serial Monitor for errors
- Verify device is online in dashboard
- Check virtual channel mappings

## License

MIT License - See main project LICENSE file
