#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_SGP30.h>
#include <U8g2lib.h>

#if __has_include("config.h")
#include "config.h"
#define SMART_HOME_HAS_CONFIG 1
#else
#define SMART_HOME_HAS_CONFIG 0
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define API_URL ""
#define DEVICE_API_TOKEN ""
#define DEVICE_ID "m-series-001"
#endif

#ifndef DEVICE_ID
#define DEVICE_ID "m-series-001"
#endif

const char *SERIES_KEY = "m_series";
const char *FIRMWARE_VERSION = "0.1.0";

constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t DHT_TYPE = DHT22;
constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint8_t MQ_ANALOG_PIN = 33;
constexpr uint8_t MQ_DIGITAL_PIN = 25;
constexpr uint8_t FLAME_ANALOG_PIN = 35;
constexpr uint8_t FLAME_DIGITAL_PIN = 26;
constexpr uint8_t CURRENT_ANALOG_PIN = 34;
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
constexpr float ACS712_SENSITIVITY_V_PER_A = 0.185;
constexpr float CURRENT_DIVIDER_RATIO = 20.0 / (10.0 + 20.0);
constexpr float CURRENT_ZERO_SENSOR_VOLTAGE = 2.500;
constexpr float CURRENT_NOISE_DEADBAND_A = 0.150;
constexpr bool INVERT_CHARGE_CURRENT_DIRECTION = true;
constexpr unsigned long LOOP_INTERVAL_MS = 10000;
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SGP30 sgp30;
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);
bool sgp30Available = false;
bool oledAvailable = false;

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

void appendBool(String &json, const char *key, bool value) {
  json += "\"";
  json += key;
  json += "\":";
  json += value ? "true" : "false";
}

void appendNumberOrNull(String &json, const char *key, float value, uint8_t decimals = 2) {
  json += "\"";
  json += key;
  json += "\":";
  json += isnan(value) ? "null" : String(value, decimals);
}

float adcToVoltage(int raw) {
  return raw * ESP32_ADC_VOLTAGE / ADC_MAX;
}

float adcVoltageToSensorVoltage(float adcVoltage) {
  return CURRENT_DIVIDER_RATIO > 0.0 ? adcVoltage / CURRENT_DIVIDER_RATIO : adcVoltage;
}

float currentFromSensorVoltage(float sensorVoltage) {
  float currentA = (sensorVoltage - CURRENT_ZERO_SENSOR_VOLTAGE) / ACS712_SENSITIVITY_V_PER_A;
  if (INVERT_CHARGE_CURRENT_DIRECTION) {
    currentA = -currentA;
  }
  return fabs(currentA) < CURRENT_NOISE_DEADBAND_A ? 0.0 : currentA;
}

int readAnalogAverage(uint8_t pin, uint8_t samples) {
  uint32_t total = 0;
  for (uint8_t i = 0; i < samples; i++) {
    total += analogRead(pin);
    delay(2);
  }
  return total / samples;
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

String rgbStatusFor(bool flameDetected, bool gasDetected, bool sensorError, bool networkOk, bool uploadOk) {
  if (flameDetected) {
    setRgb(255, 0, 0);
    return "red_flame_warning";
  }

  if (gasDetected) {
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

void drawOled(float temperature, float humidity, uint16_t eco2, uint16_t tvoc, float chargeCurrentA, const String &rgbStatus) {
  if (!oledAvailable) {
    return;
  }

  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(0, 10, "M series");
  u8g2.setCursor(0, 24);
  u8g2.print("T/H: ");
  u8g2.print(temperature, 1);
  u8g2.print("C ");
  u8g2.print(humidity, 0);
  u8g2.print("%");
  u8g2.setCursor(0, 38);
  u8g2.print("CO2/TVOC: ");
  u8g2.print(eco2);
  u8g2.print("/");
  u8g2.print(tvoc);
  u8g2.setCursor(0, 52);
  u8g2.print("I: ");
  u8g2.print(chargeCurrentA, 2);
  u8g2.print("A");
  u8g2.setCursor(0, 64);
  u8g2.print(rgbStatus);
  u8g2.sendBuffer();
}

bool postPayload(const String &payload) {
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
  setRgb(255, 0, 0);
  delay(200);
  setRgb(0, 255, 0);
  delay(200);
  setRgb(0, 0, 255);
  delay(200);
  setRgb(0, 0, 0);

  pinMode(MQ_DIGITAL_PIN, INPUT);
  pinMode(FLAME_DIGITAL_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(FLAME_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(CURRENT_ANALOG_PIN, ADC_11db);

  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  sgp30Available = sgp30.begin();
  u8g2.setI2CAddress(OLED_ADDRESS << 1);
  oledAvailable = u8g2.begin();

  Serial.println();
  Serial.println("M series firmware");
  Serial.printf("Series: %s, device: %s, firmware: %s\n", SERIES_KEY, DEVICE_ID, FIRMWARE_VERSION);
}

void loop() {
  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  const float heatIndex = dht.computeHeatIndex(temperature, humidity, false);
  const bool dhtOk = !isnan(humidity) && !isnan(temperature);

  const int mqRaw = analogRead(MQ_ANALOG_PIN);
  const float mqVoltage = adcToVoltage(mqRaw);
  const int mqDo = digitalRead(MQ_DIGITAL_PIN);
  const bool mqAnalogOk = mqRaw != MQ_ANALOG_DISCONNECTED_RAW;
  const bool gasDetected = mqDo == LOW;

  const int flameRaw = analogRead(FLAME_ANALOG_PIN);
  const float flameVoltage = adcToVoltage(flameRaw);
  const int flameDo = digitalRead(FLAME_DIGITAL_PIN);
  const bool flameDetected = flameDo == LOW;

  const int currentRaw = readAnalogAverage(CURRENT_ANALOG_PIN, 16);
  const float currentAdcVoltage = adcToVoltage(currentRaw);
  const float currentSensorVoltage = adcVoltageToSensorVoltage(currentAdcVoltage);
  const float chargeCurrentA = currentFromSensorVoltage(currentSensorVoltage);

  uint16_t eco2Ppm = 0;
  uint16_t tvocPpb = 0;
  const bool sgp30Ok = sgp30Available && sgp30.IAQmeasure();
  if (sgp30Ok) {
    eco2Ppm = sgp30.eCO2;
    tvocPpb = sgp30.TVOC;
  }

  setRgb(0, 0, 255);
  const bool networkOk = WiFi.status() == WL_CONNECTED || connectWiFi();
  const bool sensorError = !dhtOk || !sgp30Ok || !mqAnalogOk || !oledAvailable;
  const String preStatus = rgbStatusFor(flameDetected, gasDetected, sensorError, networkOk, true);

  String json = "{\"values\":{";
  appendBool(json, "dht_ok", dhtOk);
  json += ",";
  appendNumberOrNull(json, "temperature_c", dhtOk ? temperature : NAN);
  json += ",";
  appendNumberOrNull(json, "humidity_percent", dhtOk ? humidity : NAN);
  json += ",";
  appendNumberOrNull(json, "heat_index_c", dhtOk ? heatIndex : NAN);
  json += ",";
  appendBool(json, "sgp30_ok", sgp30Ok);
  json += ",\"eco2_ppm\":";
  json += sgp30Ok ? String(eco2Ppm) : "null";
  json += ",\"tvoc_ppb\":";
  json += sgp30Ok ? String(tvocPpb) : "null";
  json += ",\"mq_raw\":";
  json += mqRaw;
  json += ",\"mq_voltage\":";
  json += String(mqVoltage, 3);
  json += ",";
  appendBool(json, "mq_analog_ok", mqAnalogOk);
  json += ",\"mq_do\":";
  json += mqDo;
  json += ",";
  appendBool(json, "gas_detected", gasDetected);
  json += ",\"flame_raw\":";
  json += flameRaw;
  json += ",\"flame_voltage\":";
  json += String(flameVoltage, 3);
  json += ",\"flame_do\":";
  json += flameDo;
  json += ",";
  appendBool(json, "flame_detected", flameDetected);
  json += ",\"current_raw\":";
  json += currentRaw;
  json += ",\"current_adc_voltage\":";
  json += String(currentAdcVoltage, 3);
  json += ",\"current_sensor_voltage\":";
  json += String(currentSensorVoltage, 3);
  json += ",\"charge_current_a\":";
  json += String(chargeCurrentA, 3);
  json += ",\"charge_current_ma\":";
  json += String(chargeCurrentA * 1000.0, 0);
  json += ",";
  appendBool(json, "oled_ok", oledAvailable);
  json += ",\"wifi_rssi\":";
  json += WiFi.status() == WL_CONNECTED ? String(WiFi.RSSI()) : "null";
  json += ",";
  appendBool(json, "network_ok", networkOk);
  json += ",\"rgb_status\":\"";
  json += preStatus;
  json += "\"},\"metadata\":{\"series_key\":\"";
  json += SERIES_KEY;
  json += "\",\"device_id\":\"";
  json += DEVICE_ID;
  json += "\",\"board\":\"esp32_nodemcu_32s\",\"firmware_version\":\"";
  json += FIRMWARE_VERSION;
  json += "\",\"transport\":\"http\",\"source\":\"firmware\"}}";

  Serial.println(json);
  const bool uploadOk = postPayload(json);
  const String finalStatus = rgbStatusFor(flameDetected, gasDetected, sensorError, networkOk, uploadOk);
  drawOled(temperature, humidity, eco2Ppm, tvocPpb, chargeCurrentA, finalStatus);
  Serial.printf("rgb_status=%s, network_ok=%s, upload_ok=%s\n", finalStatus.c_str(), networkOk ? "true" : "false", uploadOk ? "true" : "false");

  delay(LOOP_INTERVAL_MS);
}
