#include <Arduino.h>

constexpr uint8_t MQ_ANALOG_PIN = 34;
constexpr uint8_t MQ_DIGITAL_PIN = 25;
constexpr uint8_t STATUS_LED_PIN = 2;

constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(MQ_DIGITAL_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);

  Serial.println();
  Serial.println("K series MQ gas sensor test");
  Serial.println("Expected wiring:");
  Serial.println("  MQ VCC -> 5V/VIN or 3V3 depending on module");
  Serial.println("  MQ GND -> GND");
  Serial.println("  MQ AO  -> GPIO34, use voltage divider if MQ is powered by 5V");
  Serial.println("  MQ DO  -> IO25 only if output is 3.3V-safe");
  Serial.println("Warm-up: MQ sensors need time before values become stable.");
}

void loop() {
  int analogRaw = analogRead(MQ_ANALOG_PIN);
  int digitalLevel = digitalRead(MQ_DIGITAL_PIN);
  float approxVoltage = analogRaw * ESP32_ADC_VOLTAGE / ADC_MAX;

  Serial.print("gas_raw=");
  Serial.print(analogRaw);
  Serial.print(", approx_adc_voltage=");
  Serial.print(approxVoltage, 3);
  Serial.print("V, do_level=");
  Serial.print(digitalLevel);
  Serial.print(", gas_detected_by_do=");
  Serial.println(digitalLevel == LOW ? "true" : "false");

  digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  delay(1000);
}
