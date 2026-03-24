/*
 * AsuraCore Switch & Slider Example
 * 
 * Demonstrates bidirectional control:
 * - Switch widgets to control relays/LEDs
 * - Slider widgets for dimming/speed control
 * - Button state feedback to dashboard
 * 
 * Dashboard Widget Setup:
 * - Channel 10: Switch widget (Relay 1)
 * - Channel 11: Switch widget (Relay 2)  
 * - Channel 12: Switch widget (LED On/Off)
 * - Channel 13: Slider widget (LED Brightness 0-255)
 * - Channel 14: Slider widget (Motor Speed 0-100)
 * - Channel 0: Gauge widget (Button state)
 * - Channel 1: Gauge widget (Potentiometer)
 * 
 * Get your DEVICE_KEY from AsuraCore Dashboard:
 * 1. Go to Dashboard -> Devices
 * 2. Create a new device or select existing one
 * 3. Copy the "Device Key" (64 character hex string)
 */

#include "AsuraCore.h"

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
// HARDWARE PINS
// =============================================================================

#define RELAY1_PIN    16
#define RELAY2_PIN    17
#define LED_PIN       2     // Built-in LED (PWM capable)
#define MOTOR_PIN     5     // PWM for motor/fan speed
#define BUTTON_PIN    0     // Boot button
#define POT_PIN       34    // Potentiometer (ADC)

// =============================================================================
// CHANNEL MAPPING
// =============================================================================

// Sensors: ESP -> Dashboard (display on gauge/chart widgets)
#define CH_BUTTON         0    // Button state
#define CH_POT            1    // Potentiometer value

// Controls: Dashboard -> ESP (use switch/slider widgets)
#define CH_RELAY1         10   // Switch widget -> Relay 1
#define CH_RELAY2         11   // Switch widget -> Relay 2
#define CH_LED_ONOFF      12   // Switch widget -> LED On/Off
#define CH_LED_BRIGHTNESS 13   // Slider widget -> LED Brightness (0-255)
#define CH_MOTOR_SPEED    14   // Slider widget -> Motor Speed (0-100)

// =============================================================================
// GLOBALS
// =============================================================================

AsuraCore asura(DEVICE_KEY);

bool ledEnabled = false;
int ledBrightness = 128;
int motorSpeed = 0;

// =============================================================================
// SWITCH HANDLERS (0 or 1)
// =============================================================================

// Relay 1 - Simple on/off switch
ASURA_WRITE(CH_RELAY1) {
  int value = param.asInt();  // 0 or 1
  digitalWrite(RELAY1_PIN, value);
  
  Serial.print("[Switch] Relay 1: ");
  Serial.println(value ? "ON" : "OFF");
}

// Relay 2 - Simple on/off switch
ASURA_WRITE(CH_RELAY2) {
  int value = param.asInt();
  digitalWrite(RELAY2_PIN, value);
  
  Serial.print("[Switch] Relay 2: ");
  Serial.println(value ? "ON" : "OFF");
}

// LED On/Off - Enable/disable LED (brightness controlled separately)
ASURA_WRITE(CH_LED_ONOFF) {
  ledEnabled = param.asBool();
  
  // Apply brightness only if enabled
  if (ledEnabled) {
    analogWrite(LED_PIN, ledBrightness);
  } else {
    analogWrite(LED_PIN, 0);
  }
  
  Serial.print("[Switch] LED: ");
  Serial.println(ledEnabled ? "ENABLED" : "DISABLED");
}

// =============================================================================
// SLIDER HANDLERS (range values)
// =============================================================================

// LED Brightness - Slider 0-255
ASURA_WRITE(CH_LED_BRIGHTNESS) {
  ledBrightness = param.asInt();
  
  // Clamp to valid range
  if (ledBrightness < 0) ledBrightness = 0;
  if (ledBrightness > 255) ledBrightness = 255;
  
  // Apply only if LED is enabled
  if (ledEnabled) {
    analogWrite(LED_PIN, ledBrightness);
  }
  
  Serial.print("[Slider] LED Brightness: ");
  Serial.print(ledBrightness);
  Serial.println("/255");
}

// Motor Speed - Slider 0-100 (percentage)
ASURA_WRITE(CH_MOTOR_SPEED) {
  motorSpeed = param.asInt();
  
  // Clamp to valid range
  if (motorSpeed < 0) motorSpeed = 0;
  if (motorSpeed > 100) motorSpeed = 100;
  
  // Convert percentage to PWM (0-255)
  int pwmValue = map(motorSpeed, 0, 100, 0, 255);
  analogWrite(MOTOR_PIN, pwmValue);
  
  Serial.print("[Slider] Motor Speed: ");
  Serial.print(motorSpeed);
  Serial.println("%");
}

// =============================================================================
// SETUP
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("   AsuraCore Switch & Slider Example");
  Serial.println("========================================");
  Serial.println();
  
  // Initialize output pins
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  
  // Initialize input pins
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Set initial states (all OFF)
  digitalWrite(RELAY1_PIN, LOW);
  digitalWrite(RELAY2_PIN, LOW);
  analogWrite(LED_PIN, 0);
  analogWrite(MOTOR_PIN, 0);
  
  // Configure AsuraCore
  asura.setDebug(true);
  asura.setInterval(2000);  // Send sensor data every 2 seconds
  
  // Connect to WiFi and MQTT
  asura.begin(WIFI_SSID, WIFI_PASS, MQTT_SERVER, MQTT_PORT);
  
  Serial.println();
  Serial.println("Dashboard Widget Setup:");
  Serial.println("  CH 10: Switch -> Relay 1");
  Serial.println("  CH 11: Switch -> Relay 2");
  Serial.println("  CH 12: Switch -> LED On/Off");
  Serial.println("  CH 13: Slider (0-255) -> LED Brightness");
  Serial.println("  CH 14: Slider (0-100) -> Motor Speed");
  Serial.println("  CH 0:  Gauge -> Button State");
  Serial.println("  CH 1:  Gauge -> Potentiometer");
  Serial.println();
}

// =============================================================================
// LOOP
// =============================================================================

void loop() {
  // Run AsuraCore (maintains WiFi, MQTT, handles commands)
  asura.run();
  
  // Read sensors and send to dashboard
  static unsigned long lastRead = 0;
  if (millis() - lastRead > 2000) {
    lastRead = millis();
    
    // Read button state (inverted because INPUT_PULLUP)
    int buttonState = !digitalRead(BUTTON_PIN);
    asura.write(CH_BUTTON, buttonState);
    
    // Read potentiometer (0-4095 on ESP32, 0-1023 on ESP8266)
    #ifdef ESP32
      int potValue = analogRead(POT_PIN);
      int potPercent = map(potValue, 0, 4095, 0, 100);
    #else
      int potValue = analogRead(A0);
      int potPercent = map(potValue, 0, 1023, 0, 100);
    #endif
    asura.write(CH_POT, potPercent);
    
    // Debug output
    Serial.println("--- Sensor Readings ---");
    Serial.print("Button: ");
    Serial.println(buttonState ? "PRESSED" : "RELEASED");
    Serial.print("Potentiometer: ");
    Serial.print(potPercent);
    Serial.println("%");
    Serial.println();
  }
  
  delay(10);
}
