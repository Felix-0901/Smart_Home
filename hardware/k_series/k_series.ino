#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_SGP30.h>
#include "config.h"

const char *SERIES_KEY = "k_series";
const char *FIRMWARE_VERSION = "0.1.0";

constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t DHT_TYPE = DHT22;

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;

constexpr uint8_t MQ_ANALOG_PIN = 34;
constexpr uint8_t MQ_DIGITAL_PIN = 25;

constexpr uint8_t FLAME_ANALOG_PIN = 35;
constexpr uint8_t FLAME_DIGITAL_PIN = 26;

constexpr uint8_t RGB_RED_PIN = 16;
constexpr uint8_t RGB_GREEN_PIN = 17;
constexpr uint8_t RGB_BLUE_PIN = 18;
constexpr bool RGB_COMMON_ANODE = false;

constexpr uint8_t RED_CHANNEL = 0;
constexpr uint8_t GREEN_CHANNEL = 1;
constexpr uint8_t BLUE_CHANNEL = 2;
constexpr uint32_t PWM_FREQUENCY = 5000;
constexpr uint8_t PWM_RESOLUTION = 8;

constexpr uint8_t STATUS_LED_PIN = 2;
constexpr unsigned long SEND_INTERVAL_MS = 10000;
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 20000;
constexpr int MQ_ANALOG_FAULT_RAW_MAX = 5;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SGP30 sgp30;
bool sgp30Available = false;

unsigned long lastSendAt = 0;
bool lastDhtOk = false;
bool lastSgp30Ok = false;
bool lastMqAnalogOk = false;
bool lastGasDetected = false;
bool lastFlameDetected = false;

uint8_t ledValue(uint8_t value) {
  return RGB_COMMON_ANODE ? 255 - value : value;
}

void setRgb(uint8_t red, uint8_t green, uint8_t blue) {
  ledcWrite(RED_CHANNEL, ledValue(red));
  ledcWrite(GREEN_CHANNEL, ledValue(green));
  ledcWrite(BLUE_CHANNEL, ledValue(blue));
}

void setupRgb() {
  ledcSetup(RED_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(GREEN_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(BLUE_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);

  ledcAttachPin(RGB_RED_PIN, RED_CHANNEL);
  ledcAttachPin(RGB_GREEN_PIN, GREEN_CHANNEL);
  ledcAttachPin(RGB_BLUE_PIN, BLUE_CHANNEL);

  setRgb(0, 0, 255);
}

void updateStatusRgb(bool uploadOk, bool networkOk) {
  if (lastFlameDetected) {
    setRgb(255, 0, 0);
    return;
  }

  if (lastGasDetected) {
    setRgb(255, 180, 0);
    return;
  }

  if (!lastDhtOk || !lastSgp30Ok || !lastMqAnalogOk) {
    setRgb(180, 0, 255);
    return;
  }

  if (!networkOk) {
    setRgb(0, 255, 255);
    return;
  }

  if (!uploadOk) {
    setRgb(255, 255, 255);
    return;
  }

  setRgb(0, 255, 0);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  setRgb(0, 0, 255);
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, LOW);
    setRgb(0, 255, 255);
    Serial.println("\nWiFi connection timed out.");
    return;
  }

  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("\nWiFi connected. IP: %s\n", WiFi.localIP().toString().c_str());
}

void appendNumberOrNull(String &json, const char *key, float value, uint8_t decimals = 2) {
  json += "\"";
  json += key;
  json += "\":";

  if (isnan(value)) {
    json += "null";
    return;
  }

  json += String(value, decimals);
}

String buildPayload() {
  float dhtHumidity = dht.readHumidity();
  float dhtTemperature = dht.readTemperature();
  float heatIndex = dht.computeHeatIndex(dhtTemperature, dhtHumidity, false);
  lastDhtOk = !isnan(dhtHumidity) && !isnan(dhtTemperature);

  int mqAnalog = analogRead(MQ_ANALOG_PIN);
  int mqDigitalLevel = digitalRead(MQ_DIGITAL_PIN);
  int flameAnalog = analogRead(FLAME_ANALOG_PIN);
  int flameDigitalLevel = digitalRead(FLAME_DIGITAL_PIN);
  lastGasDetected = mqDigitalLevel == LOW;
  lastFlameDetected = flameDigitalLevel == LOW;
  lastMqAnalogOk = mqAnalog > MQ_ANALOG_FAULT_RAW_MAX;

  String json = "{";
  json += "\"values\":{";
  appendNumberOrNull(json, "temperature_c", dhtTemperature);
  json += ",";
  appendNumberOrNull(json, "humidity_percent", dhtHumidity);
  json += ",";
  appendNumberOrNull(json, "heat_index_c", heatIndex);
  json += ",";

  lastSgp30Ok = sgp30Available && sgp30.IAQmeasure();
  if (lastSgp30Ok) {
    json += "\"eco2_ppm\":";
    json += sgp30.eCO2;
    json += ",\"tvoc_ppb\":";
    json += sgp30.TVOC;
    json += ",";
  }

  json += "\"gas_raw\":";
  json += mqAnalog;
  json += ",\"gas_analog_ok\":";
  json += lastMqAnalogOk ? "true" : "false";
  json += ",\"gas_digital_level\":";
  json += mqDigitalLevel;
  json += ",\"gas_detected\":";
  json += mqDigitalLevel == LOW ? "true" : "false";
  json += ",\"flame_raw\":";
  json += flameAnalog;
  json += ",\"flame_digital_level\":";
  json += flameDigitalLevel;
  json += ",\"flame_detected\":";
  json += flameDigitalLevel == LOW ? "true" : "false";
  json += ",\"wifi_rssi\":";
  json += WiFi.RSSI();
  json += "},";

  json += "\"metadata\":{";
  json += "\"series_key\":\"";
  json += SERIES_KEY;
  json += "\",\"board\":\"mh_et_live_esp32_minikit\",";
  json += "\"firmware_version\":\"";
  json += FIRMWARE_VERSION;
  json += "\",\"sgp30_available\":";
  json += sgp30Available ? "true" : "false";
  json += "}}";

  return json;
}

void sendReading() {
  String payload = buildPayload();
  connectWiFi();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Skipping POST because WiFi is not connected.");
    Serial.println(payload);
    updateStatusRgb(false, false);
    return;
  }

  HTTPClient http;
  setRgb(0, 0, 255);

  Serial.println(payload);

  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_API_TOKEN);

  int statusCode = http.POST(payload);
  String response = http.getString();

  Serial.printf("POST status: %d\n", statusCode);
  Serial.println(response);
  updateStatusRgb(statusCode >= 200 && statusCode < 300, true);

  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(STATUS_LED_PIN, OUTPUT);
  setupRgb();
  pinMode(MQ_DIGITAL_PIN, INPUT);
  pinMode(FLAME_DIGITAL_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(FLAME_ANALOG_PIN, ADC_11db);

  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  sgp30Available = sgp30.begin();

  Serial.printf("SGP30 sensor available: %s\n", sgp30Available ? "yes" : "no");
  sendReading();
  lastSendAt = millis();
}

void loop() {
  if (millis() - lastSendAt >= SEND_INTERVAL_MS) {
    sendReading();
    lastSendAt = millis();
  }
}
