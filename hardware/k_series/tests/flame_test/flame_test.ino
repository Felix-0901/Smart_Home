#include <Arduino.h>

constexpr uint8_t FLAME_ANALOG_PIN = 35;
constexpr uint8_t FLAME_DIGITAL_PIN = 26;
constexpr uint8_t STATUS_LED_PIN = 2;

constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(FLAME_DIGITAL_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(FLAME_ANALOG_PIN, ADC_11db);

  Serial.println();
  Serial.println("K series flame / infrared sensor test");
  Serial.println("Expected wiring:");
  Serial.println("  Sensor VCC -> 3V3");
  Serial.println("  Sensor GND -> GND");
  Serial.println("  Sensor AO  -> IO35");
  Serial.println("  Sensor DO  -> IO26");
}

void loop() {
  int analogRaw = analogRead(FLAME_ANALOG_PIN);
  int digitalLevel = digitalRead(FLAME_DIGITAL_PIN);
  float approxVoltage = analogRaw * ESP32_ADC_VOLTAGE / ADC_MAX;

  Serial.print("flame_raw=");
  Serial.print(analogRaw);
  Serial.print(", approx_adc_voltage=");
  Serial.print(approxVoltage, 3);
  Serial.print("V, do_level=");
  Serial.print(digitalLevel);
  Serial.print(", flame_detected_by_do=");
  Serial.println(digitalLevel == LOW ? "true" : "false");

  digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  delay(1000);
}
