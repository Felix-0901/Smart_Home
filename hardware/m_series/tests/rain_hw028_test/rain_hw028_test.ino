#include <Arduino.h>

constexpr uint8_t RAIN_ANALOG_PIN = 32;

constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;
constexpr unsigned long LOOP_INTERVAL_MS = 1000;

float adcToVoltage(int raw) {
  return raw * ESP32_ADC_VOLTAGE / ADC_MAX;
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  analogReadResolution(12);
  analogSetPinAttenuation(RAIN_ANALOG_PIN, ADC_11db);

  Serial.println();
  Serial.println("M series HW-028 two-pin rain plate test");
  Serial.printf("Rain divider read pin: GPIO%d\n", RAIN_ANALOG_PIN);
  Serial.println("Wiring: 3V3 -> 10k resistor -> GPIO32 -> rain plate -> GND.");
  Serial.println("The two rain plate pins have no polarity.");
}

void loop() {
  const int rainRaw = analogRead(RAIN_ANALOG_PIN);
  const float rainVoltage = adcToVoltage(rainRaw);

  Serial.print("rain_raw=");
  Serial.print(rainRaw);
  Serial.print(", rain_voltage=");
  Serial.print(rainVoltage, 3);
  Serial.print(", rain_level_hint=");
  if (rainRaw < 1200) {
    Serial.println("wet_or_conductive");
  } else if (rainRaw < 2800) {
    Serial.println("damp");
  } else {
    Serial.println("dry_or_open");
  }

  delay(LOOP_INTERVAL_MS);
}
