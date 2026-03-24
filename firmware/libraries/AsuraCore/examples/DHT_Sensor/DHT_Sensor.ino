/*
 * AsuraCore DHT Sensor Example
 * 
 * Read DHT11/DHT22 temperature & humidity sensor
 * Control relay from dashboard
 * 
 * Required Libraries:
 * - DHT sensor library by Adafruit
 * - Adafruit Unified Sensor
 * 
 * Get your DEVICE_KEY from AsuraCore Dashboard:
 * 1. Go to Dashboard -> Devices
 * 2. Create a new device or select existing one
 * 3. Copy the "Device Key" (64 character hex string)
 */

#include "AsuraCore.h"
#include <DHT.h>

// =============================================================================
// CONFIGURATION - UPDATE THESE!
// =============================================================================

#define WIFI_SSID     "YourWiFiSSID"
#define WIFI_PASS     "YourWiFiPassword"
#define MQTT_SERVER   "<your_asuracore_server_ip_or_domain>"  // e.g., "192.168.1.100" or "asura.example.com"
#define MQTT_PORT     1883

// Get this from AsuraCore Dashboard -> Device Detail -> Device Key
#define DEVICE_KEY    "<paste_your_64_char_device_key_here>"

// =============================================================================
// HARDWARE CONFIGURATION
// =============================================================================

#define DHT_PIN       4
#define DHT_TYPE      DHT22    // DHT11 or DHT22
#define RELAY_PIN     16

// =============================================================================
// CHANNEL MAPPING
// =============================================================================

// Sensors (ESP -> Dashboard)
#define CH_TEMPERATURE    0
#define CH_HUMIDITY       1
#define CH_HEAT_INDEX     2

// Controls (Dashboard -> ESP)
#define CH_RELAY          10
#define CH_AUTO_MODE      11
#define CH_TEMP_THRESHOLD 12

// =============================================================================
// GLOBALS
// =============================================================================

AsuraCore asura(DEVICE_KEY);
DHT dht(DHT_PIN, DHT_TYPE);

bool autoMode = false;
float tempThreshold = 28.0;

// =============================================================================
// CHANNEL HANDLERS
// =============================================================================

// Manual relay control from dashboard
ASURA_WRITE(CH_RELAY) {
  if (!autoMode) {
    int value = param.asInt();
    digitalWrite(RELAY_PIN, value);
    Serial.print("[Relay] Manual: ");
    Serial.println(value ? "ON" : "OFF");
  } else {
    Serial.println("[Relay] Ignored - Auto mode active");
  }
}

// Auto mode toggle
ASURA_WRITE(CH_AUTO_MODE) {
  autoMode = param.asBool();
  Serial.print("[Auto Mode] ");
  Serial.println(autoMode ? "ENABLED" : "DISABLED");
}

// Temperature threshold for auto mode
ASURA_WRITE(CH_TEMP_THRESHOLD) {
  tempThreshold = param.asFloat();
  Serial.print("[Threshold] ");
  Serial.print(tempThreshold);
  Serial.println("C");
}

// =============================================================================
// SETUP
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("=== AsuraCore DHT Sensor ===");
  
  // Initialize hardware
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  
  dht.begin();
  
  // Configure AsuraCore
  asura.setDebug(true);
  asura.setInterval(10000);  // Send every 10 seconds
  asura.begin(WIFI_SSID, WIFI_PASS, MQTT_SERVER, MQTT_PORT);
  
  Serial.println("Setup complete!");
}

// =============================================================================
// LOOP
// =============================================================================

void loop() {
  asura.run();
  
  // Read DHT sensor
  static unsigned long lastRead = 0;
  if (millis() - lastRead > 10000) {
    lastRead = millis();
    
    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();
    
    if (isnan(humidity) || isnan(temperature)) {
      Serial.println("[DHT] Read failed!");
      return;
    }
    
    float heatIndex = dht.computeHeatIndex(temperature, humidity, false);
    
    // Send to dashboard
    asura.write(CH_TEMPERATURE, temperature);
    asura.write(CH_HUMIDITY, humidity);
    asura.write(CH_HEAT_INDEX, heatIndex);
    
    Serial.println("------------------------------");
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" C");
    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
    Serial.print("Heat Index: ");
    Serial.print(heatIndex);
    Serial.println(" C");
    
    // Auto mode: turn on relay if temp exceeds threshold
    if (autoMode) {
      bool shouldBeOn = temperature > tempThreshold;
      digitalWrite(RELAY_PIN, shouldBeOn);
      Serial.print("Auto Relay: ");
      Serial.println(shouldBeOn ? "ON" : "OFF");
    }
  }
  
  delay(10);
}
