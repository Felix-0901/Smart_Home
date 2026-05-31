#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_SGP30.h>

#if __has_include("config.h")
#include "config.h"
#define SMART_HOME_HAS_CONFIG 1
#else
#define SMART_HOME_HAS_CONFIG 0
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define API_URL ""
#define DEVICE_API_TOKEN ""
#define DEVICE_ID "k-series-001"
#endif

#ifndef DEVICE_ID
#define DEVICE_ID "k-series-001"
#endif

const char *SERIES_KEY = "k_series";
const char *FIRMWARE_VERSION = "0.3.0";

constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t DHT_TYPE = DHT22;
constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t MQ_ANALOG_PIN = 33;
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
constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;
constexpr int MQ_ANALOG_DISCONNECTED_RAW = 0;
constexpr unsigned long LOOP_INTERVAL_MS = 10000;
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SGP30 sgp30;
bool sgp30Available = false;
bool lastUploadOk = false;
bool lastNetworkOk = false;

struct SensorReading {
  bool dhtOk;
  float temperatureC;
  float humidityPercent;
  float heatIndexC;
  bool sgp30Ok;
  uint16_t eco2Ppm;
  uint16_t tvocPpb;
  int mqRaw;
  float mqVoltage;
  int mqDo;
  bool mqAnalogOk;
  bool gasDetected;
  int flameRaw;
  float flameVoltage;
  int flameDo;
  bool flameDetected;
  const char *rgbStatus;
};

uint8_t ledValue(uint8_t value) {
  return RGB_COMMON_ANODE ? 255 - value : value;
}

void setRgb(uint8_t red, uint8_t green, uint8_t blue) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(RGB_RED_PIN, ledValue(red));
  ledcWrite(RGB_GREEN_PIN, ledValue(green));
  ledcWrite(RGB_BLUE_PIN, ledValue(blue));
#else
  ledcWrite(RED_CHANNEL, ledValue(red));
  ledcWrite(GREEN_CHANNEL, ledValue(green));
  ledcWrite(BLUE_CHANNEL, ledValue(blue));
#endif
}

void setupRgb() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(RGB_RED_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttach(RGB_GREEN_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttach(RGB_BLUE_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
#else
  ledcSetup(RED_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(GREEN_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(BLUE_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttachPin(RGB_RED_PIN, RED_CHANNEL);
  ledcAttachPin(RGB_GREEN_PIN, GREEN_CHANNEL);
  ledcAttachPin(RGB_BLUE_PIN, BLUE_CHANNEL);
#endif
}

void runRgbSelfTest() {
  setRgb(255, 0, 0);
  delay(250);
  setRgb(0, 255, 0);
  delay(250);
  setRgb(0, 0, 255);
  delay(250);
  setRgb(255, 255, 255);
  delay(250);
  setRgb(0, 0, 0);
}

float adcToVoltage(int raw) {
  return raw * ESP32_ADC_VOLTAGE / ADC_MAX;
}

void appendNumberOrNull(String &json, const char *key, float value, uint8_t decimals = 2) {
  json += "\"";
  json += key;
  json += "\":";
  json += isnan(value) ? "null" : String(value, decimals);
}

void appendBool(String &json, const char *key, bool value) {
  json += "\"";
  json += key;
  json += "\":";
  json += value ? "true" : "false";
}

SensorReading readSensors() {
  SensorReading reading{};
  reading.humidityPercent = dht.readHumidity();
  reading.temperatureC = dht.readTemperature();
  reading.heatIndexC = dht.computeHeatIndex(reading.temperatureC, reading.humidityPercent, false);
  reading.dhtOk = !isnan(reading.humidityPercent) && !isnan(reading.temperatureC);

  reading.mqRaw = analogRead(MQ_ANALOG_PIN);
  reading.mqVoltage = adcToVoltage(reading.mqRaw);
  reading.mqDo = digitalRead(MQ_DIGITAL_PIN);
  reading.mqAnalogOk = reading.mqRaw != MQ_ANALOG_DISCONNECTED_RAW;
  reading.gasDetected = reading.mqDo == LOW;

  reading.flameRaw = analogRead(FLAME_ANALOG_PIN);
  reading.flameVoltage = adcToVoltage(reading.flameRaw);
  reading.flameDo = digitalRead(FLAME_DIGITAL_PIN);
  reading.flameDetected = reading.flameDo == LOW;

  reading.sgp30Ok = sgp30Available && sgp30.IAQmeasure();
  if (reading.sgp30Ok) {
    reading.eco2Ppm = sgp30.eCO2;
    reading.tvocPpb = sgp30.TVOC;
  }

  return reading;
}

const char *evaluateStatus(SensorReading &reading, bool networkOk, bool uploadOk) {
  const bool sensorError = !reading.dhtOk || !reading.sgp30Ok || !reading.mqAnalogOk;

  if (reading.flameDetected) {
    setRgb(255, 0, 0);
    return "red_flame_warning";
  }

  if (reading.gasDetected) {
    setRgb(255, 180, 0);
    return "yellow_gas_warning";
  }

  if (sensorError) {
    setRgb(180, 0, 255);
    return "purple_sensor_error";
  }

  if (!networkOk) {
    setRgb(0, 255, 255);
    return "cyan_network_offline";
  }

  if (!uploadOk) {
    setRgb(255, 255, 255);
    return "white_backend_error";
  }

  setRgb(0, 255, 0);
  return "green_normal";
}

String buildPayload(const SensorReading &reading) {
  String json = "{";
  json += "\"values\":{";
  appendBool(json, "dht_ok", reading.dhtOk);
  json += ",";
  appendNumberOrNull(json, "temperature_c", reading.dhtOk ? reading.temperatureC : NAN);
  json += ",";
  appendNumberOrNull(json, "humidity_percent", reading.dhtOk ? reading.humidityPercent : NAN);
  json += ",";
  appendNumberOrNull(json, "heat_index_c", reading.dhtOk ? reading.heatIndexC : NAN);
  json += ",";
  appendBool(json, "sgp30_ok", reading.sgp30Ok);
  json += ",\"eco2_ppm\":";
  json += reading.sgp30Ok ? String(reading.eco2Ppm) : "null";
  json += ",\"tvoc_ppb\":";
  json += reading.sgp30Ok ? String(reading.tvocPpb) : "null";
  json += ",\"mq_raw\":";
  json += reading.mqRaw;
  json += ",\"mq_voltage\":";
  json += String(reading.mqVoltage, 3);
  json += ",";
  appendBool(json, "mq_analog_ok", reading.mqAnalogOk);
  json += ",\"mq_do\":";
  json += reading.mqDo;
  json += ",";
  appendBool(json, "gas_detected", reading.gasDetected);
  json += ",\"flame_raw\":";
  json += reading.flameRaw;
  json += ",\"flame_voltage\":";
  json += String(reading.flameVoltage, 3);
  json += ",\"flame_do\":";
  json += reading.flameDo;
  json += ",";
  appendBool(json, "flame_detected", reading.flameDetected);
  json += ",\"wifi_rssi\":";
  json += WiFi.status() == WL_CONNECTED ? String(WiFi.RSSI()) : "null";
  json += ",";
  appendBool(json, "network_ok", lastNetworkOk);
  json += ",";
  appendBool(json, "upload_ok", lastUploadOk);
  json += ",\"rgb_status\":\"";
  json += reading.rgbStatus;
  json += "\"},\"metadata\":{";
  json += "\"series_key\":\"";
  json += SERIES_KEY;
  json += "\",\"device_id\":\"";
  json += DEVICE_ID;
  json += "\",\"board\":\"mh_et_live_esp32_minikit\",";
  json += "\"firmware_version\":\"";
  json += FIRMWARE_VERSION;
  json += "\",\"transport\":\"http\",";
  json += "\"source\":\"firmware\"";
  json += "}}";
  return json;
}

bool connectWiFi() {
  if (!SMART_HOME_HAS_CONFIG || strlen(WIFI_SSID) == 0) {
    return false;
  }

  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  setRgb(0, 0, 255);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(300);
  }

  return WiFi.status() == WL_CONNECTED;
}

bool sendReading(const String &payload) {
  if (!connectWiFi() || strlen(API_URL) == 0) {
    return false;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-token", DEVICE_API_TOKEN);
  const int statusCode = http.POST(payload);
  Serial.printf("POST status: %d\n", statusCode);
  Serial.println(http.getString());
  http.end();

  return statusCode >= 200 && statusCode < 300;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  setupRgb();
  runRgbSelfTest();

  pinMode(MQ_DIGITAL_PIN, INPUT);
  pinMode(FLAME_DIGITAL_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(FLAME_ANALOG_PIN, ADC_11db);

  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  sgp30Available = sgp30.begin();

  Serial.println();
  Serial.println("K series firmware");
  Serial.printf("Series: %s, device: %s, firmware: %s\n", SERIES_KEY, DEVICE_ID, FIRMWARE_VERSION);
  Serial.printf("SGP30 available: %s\n", sgp30Available ? "yes" : "no");
}

void loop() {
  SensorReading reading = readSensors();
  reading.rgbStatus = "blue_transient";
  setRgb(0, 0, 255);

  String payload = buildPayload(reading);
  Serial.println(payload);

  lastNetworkOk = WiFi.status() == WL_CONNECTED || connectWiFi();
  lastUploadOk = sendReading(payload);
  reading.rgbStatus = evaluateStatus(reading, lastNetworkOk, lastUploadOk);
  Serial.printf("rgb_status=%s, network_ok=%s, upload_ok=%s\n", reading.rgbStatus, lastNetworkOk ? "true" : "false", lastUploadOk ? "true" : "false");

  delay(LOOP_INTERVAL_MS);
}
