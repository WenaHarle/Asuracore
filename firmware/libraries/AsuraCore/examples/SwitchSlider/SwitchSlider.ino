/*
 * AsuraCore - Switch & Slider Example
 * ============================================================================
 *
 * Contoh kontrol perangkat dari dashboard AsuraCore.
 *
 * Yang perlu kamu lakukan:
 *   1. Isi WIFI_SSID, WIFI_PASS, MQTT_SERVER di bawah.
 *   2. Tempel DEVICE_KEY dari dashboard AsuraCore.
 *   3. Sesuaikan PIN sesuai wiring kamu (kalau perlu).
 *   4. Upload ke ESP32/ESP8266. Selesai!
 *
 * Channel dashboard:
 *   CH 0  - Gauge   : Status tombol
 *   CH 1  - Gauge   : Nilai potensiometer (%)
 *   CH 10 - Switch  : Relay 1
 *   CH 11 - Switch  : Relay 2
 *   CH 12 - Switch  : LED ON/OFF
 *   CH 13 - Slider  : Brightness LED (0-255)
 *   CH 14 - Slider  : Kecepatan Motor (0-100%)
 *
 * Cara dapat DEVICE_KEY:
 *   Dashboard -> Devices -> Buat/pilih device -> Copy Device Key
 */

#include "AsuraCore.h"

// ============================================================================
// 1. KONFIGURASI WiFi & SERVER (UBAH SESUAI PUNYAMU!)
// ============================================================================

#define WIFI_SSID    "aicenter"
#define WIFI_PASS    "aicenter"
#define MQTT_SERVER  "10.39.30.25"   // contoh: "192.168.1.100"
#define DEVICE_KEY   "32bd45de4a6f3052926d44039a8b981b13fc2f7a2a034a1a7bf674ab04f59526"

// ============================================================================
// 2. PIN HARDWARE (sesuaikan dengan rangkaianmu)
// ============================================================================

#define RELAY1_PIN  16
#define RELAY2_PIN  17
#define LED_PIN     2     // LED bawaan, support PWM
#define MOTOR_PIN   5     // Pin PWM untuk motor/fan
#define BUTTON_PIN  0     // Tombol BOOT
#define POT_PIN     34    // Potensiometer (analog)

// ============================================================================
// 3. INISIALISASI ASURACORE
// ============================================================================

AsuraCore asura(DEVICE_KEY);

// ============================================================================
// 4. SETUP - Hubungkan channel dashboard ke pin
// ============================================================================

void setup() {
  Serial.begin(115200);

  asura.setDebug(true);       // Tampilkan log di Serial Monitor
  asura.setInterval(2000);    // Kirim data sensor tiap 2 detik

  // Hubungkan ke WiFi & server
  asura.begin(WIFI_SSID, WIFI_PASS, MQTT_SERVER);

  // ---- KONTROL DARI DASHBOARD KE ALAT ----
  asura.bindSwitch(10, RELAY1_PIN);              // Switch ch10 -> Relay 1
  asura.bindSwitch(11, RELAY2_PIN);              // Switch ch11 -> Relay 2
  asura.bindSlider(13, LED_PIN,   0, 255);       // Slider ch13 -> LED brightness
  asura.bindSlider(14, MOTOR_PIN, 0, 100);       // Slider ch14 -> Motor speed (%)

  // LED ON/OFF (ch12) butuh logika kustom karena kerja bareng slider brightness.
  // Lihat handler di bawah.
  asura.onReceive(12, onLedSwitch);

  // ---- BACA SENSOR -> KIRIM KE DASHBOARD ----
  asura.bindSensor(0, BUTTON_PIN, DIGITAL_INVERTED);  // Tombol (INPUT_PULLUP)
  asura.bindSensor(1, POT_PIN,    ANALOG_PERCENT);    // Potensio dalam %
}

// ============================================================================
// 5. LOOP - cukup panggil run(), semua otomatis!
// ============================================================================

void loop() {
  asura.run();
}

// ============================================================================
// 6. HANDLER KUSTOM (opsional)
// ============================================================================

// LED ON/OFF: pakai brightness terakhir dari slider ch13.
// Saat OFF -> matikan. Saat ON -> nyalakan dengan brightness yang dipilih.
void onLedSwitch(AsuraParam param) {
  bool on = param.asBool();
  int brightness = (int)asura.read(13);   // ambil nilai slider ch13
  analogWrite(LED_PIN, on ? brightness : 0);

  Serial.print("[LED] ");
  Serial.println(on ? "ON" : "OFF");
}
