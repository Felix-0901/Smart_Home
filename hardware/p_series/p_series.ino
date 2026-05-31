#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

#if __has_include("config.h")
#include "config.h"
#define SMART_HOME_HAS_CONFIG 1
#else
#define SMART_HOME_HAS_CONFIG 0
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define MQTT_HOST ""
#define MQTT_PORT 1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD ""
#define MQTT_TOPIC_PREFIX "smart-home"
#define DEVICE_ID "p-series-001"
#define RELAY_ACTIVE_HIGH true
#endif

#ifndef MQTT_USERNAME
#define MQTT_USERNAME ""
#endif

#ifndef MQTT_PASSWORD
#define MQTT_PASSWORD ""
#endif

#ifndef MQTT_TOPIC_PREFIX
#define MQTT_TOPIC_PREFIX "smart-home"
#endif

#ifndef DEVICE_ID
#define DEVICE_ID "p-series-001"
#endif

#ifndef RELAY_ACTIVE_HIGH
#define RELAY_ACTIVE_HIGH true
#endif

const char *SERIES_KEY = "p_series";
const char *FIRMWARE_VERSION = "0.1.0";

constexpr uint8_t RELAY_PIN = A0;
constexpr uint8_t CURRENT_PIN = A1;
constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr unsigned long MQTT_RECONNECT_INTERVAL_MS = 3000;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 10000;
constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

bool relayOn = false;
bool mqttConnected = false;
String lastCommandId = "";
unsigned long lastMqttReconnectAt = 0;
unsigned long lastTelemetryAt = 0;

String topicBase() {
  String base = MQTT_TOPIC_PREFIX;
  if (base.endsWith("/")) {
    base.remove(base.length() - 1);
  }
  base += "/";
  base += SERIES_KEY;
  base += "/";
  base += DEVICE_ID;
  return base;
}

String commandTopic() {
  return topicBase() + "/command";
}

String stateTopic() {
  return topicBase() + "/state";
}

String telemetryTopic() {
  return topicBase() + "/telemetry";
}

String availabilityTopic() {
  return topicBase() + "/availability";
}

void applyRelay(bool nextRelayOn) {
  relayOn = nextRelayOn;
  const bool pinHigh = RELAY_ACTIVE_HIGH ? relayOn : !relayOn;
  digitalWrite(RELAY_PIN, pinHigh ? HIGH : LOW);
}

int readCurrentRaw() {
  uint32_t total = 0;
  for (uint8_t i = 0; i < 16; i++) {
    total += analogRead(CURRENT_PIN);
    delay(2);
  }
  return total / 16;
}

float adcToVoltage(int raw) {
  return raw * ESP32_ADC_VOLTAGE / ADC_MAX;
}

String extractStringValue(const String &payload, const char *key) {
  String needle = "\"";
  needle += key;
  needle += "\"";
  int keyIndex = payload.indexOf(needle);
  if (keyIndex < 0) {
    return "";
  }

  int colonIndex = payload.indexOf(':', keyIndex + needle.length());
  if (colonIndex < 0) {
    return "";
  }

  int startQuote = payload.indexOf('"', colonIndex + 1);
  if (startQuote < 0) {
    return "";
  }

  int endQuote = payload.indexOf('"', startQuote + 1);
  if (endQuote < 0) {
    return "";
  }

  return payload.substring(startQuote + 1, endQuote);
}

bool parseRelayCommand(const String &payload, bool &nextRelayOn) {
  String compact = payload;
  compact.replace(" ", "");
  compact.replace("\n", "");
  compact.replace("\r", "");
  compact.replace("\t", "");
  compact.toLowerCase();

  if (compact.indexOf("\"relay_on\":true") >= 0) {
    nextRelayOn = true;
    return true;
  }

  if (compact.indexOf("\"relay_on\":false") >= 0) {
    nextRelayOn = false;
    return true;
  }

  return false;
}

String statePayload() {
  const int currentRaw = readCurrentRaw();
  String json = "{";
  json += "\"relay_on\":";
  json += relayOn ? "true" : "false";
  json += ",\"relay_command_id\":\"";
  json += lastCommandId;
  json += "\",\"current_raw\":";
  json += currentRaw;
  json += ",\"current_adc_voltage\":";
  json += String(adcToVoltage(currentRaw), 3);
  json += ",\"load_current_a\":null";
  json += ",\"load_power_w\":null";
  json += ",\"load_detected\":null";
  json += ",\"mqtt_connected\":";
  json += mqtt.connected() ? "true" : "false";
  json += ",\"wifi_rssi\":";
  json += WiFi.status() == WL_CONNECTED ? String(WiFi.RSSI()) : "null";
  json += ",\"firmware_version\":\"";
  json += FIRMWARE_VERSION;
  json += "\"}";
  return json;
}

void publishState(bool retained = true) {
  if (!mqtt.connected()) {
    return;
  }

  const String payload = statePayload();
  mqtt.publish(stateTopic().c_str(), payload.c_str(), retained);
  Serial.print("state: ");
  Serial.println(payload);
}

void publishTelemetry() {
  if (!mqtt.connected()) {
    return;
  }

  const String payload = statePayload();
  mqtt.publish(telemetryTopic().c_str(), payload.c_str(), false);
  Serial.print("telemetry: ");
  Serial.println(payload);
}

void handleMqttMessage(char *topic, byte *payload, unsigned int length) {
  String message;
  message.reserve(length);
  for (unsigned int i = 0; i < length; i++) {
    message += static_cast<char>(payload[i]);
  }

  Serial.print("MQTT message ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(message);

  bool nextRelayOn = false;
  if (!parseRelayCommand(message, nextRelayOn)) {
    Serial.println("Ignored MQTT command without relay_on.");
    return;
  }

  lastCommandId = extractStringValue(message, "command_id");
  applyRelay(nextRelayOn);
  publishState(true);
}

bool connectWiFi() {
  if (!SMART_HOME_HAS_CONFIG || strlen(WIFI_SSID) == 0) {
    return false;
  }

  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(300);
    Serial.print(".");
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi connected. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("WiFi connection timed out.");
  }

  return WiFi.status() == WL_CONNECTED;
}

void connectMqttIfNeeded() {
  if (!connectWiFi() || strlen(MQTT_HOST) == 0 || mqtt.connected()) {
    mqttConnected = mqtt.connected();
    return;
  }

  if (millis() - lastMqttReconnectAt < MQTT_RECONNECT_INTERVAL_MS) {
    return;
  }

  lastMqttReconnectAt = millis();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(handleMqttMessage);

  const String willTopic = availabilityTopic();
  const String clientId = String("smart-home-") + DEVICE_ID;
  bool connected = false;

  if (strlen(MQTT_USERNAME) > 0) {
    connected = mqtt.connect(
        clientId.c_str(),
        MQTT_USERNAME,
        MQTT_PASSWORD,
        willTopic.c_str(),
        1,
        true,
        "offline"
    );
  } else {
    connected = mqtt.connect(
        clientId.c_str(),
        willTopic.c_str(),
        1,
        true,
        "offline"
    );
  }

  mqttConnected = connected;
  if (!connected) {
    Serial.printf("MQTT connect failed. state=%d\n", mqtt.state());
    return;
  }

  mqtt.publish(willTopic.c_str(), "online", true);
  mqtt.subscribe(commandTopic().c_str(), 1);
  publishState(true);
  Serial.print("Subscribed command topic: ");
  Serial.println(commandTopic());
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(CURRENT_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(CURRENT_PIN, ADC_11db);
  applyRelay(false);

  Serial.println();
  Serial.println("P series smart plug firmware");
  Serial.printf("Relay pin A0 resolves to GPIO %d\n", RELAY_PIN);
  Serial.printf("Current pin A1 resolves to GPIO %d\n", CURRENT_PIN);
  Serial.printf("Device: %s, firmware: %s\n", DEVICE_ID, FIRMWARE_VERSION);

  connectWiFi();
  connectMqttIfNeeded();
}

void loop() {
  connectMqttIfNeeded();

  if (mqtt.connected()) {
    mqtt.loop();
  }

  if (millis() - lastTelemetryAt >= TELEMETRY_INTERVAL_MS) {
    publishTelemetry();
    lastTelemetryAt = millis();
  }
}
