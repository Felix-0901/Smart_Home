#include <Arduino.h>

const uint8_t adcPins[] = {32, 33, 34, 35, 39};
const uint8_t digitalPins[] = {0, 2, 4, 5, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27};

void setup() {
  Serial.begin(115200);
  delay(1500);

  analogReadResolution(12);
  for (uint8_t i = 0; i < sizeof(adcPins); i++) {
    analogSetPinAttenuation(adcPins[i], ADC_11db);
  }

  for (uint8_t i = 0; i < sizeof(digitalPins); i++) {
    pinMode(digitalPins[i], INPUT);
  }

  Serial.println();
  Serial.println("T series MQ ADC / digital pin scan");
  Serial.println("Move MQ AO to one ADC pin and look for a stable non-zero raw value.");
}

void loop() {
  Serial.print("ADC ");
  for (uint8_t i = 0; i < sizeof(adcPins); i++) {
    uint8_t pin = adcPins[i];
    int raw = analogRead(pin);

    Serial.print("GPIO");
    Serial.print(pin);
    Serial.print("=");
    Serial.print(raw);
    Serial.print(" ");
  }

  Serial.print("| DIGITAL ");
  for (uint8_t i = 0; i < sizeof(digitalPins); i++) {
    uint8_t pin = digitalPins[i];
    int level = digitalRead(pin);

    Serial.print("G");
    Serial.print(pin);
    Serial.print("=");
    Serial.print(level);
    Serial.print(" ");
  }

  Serial.println();
  delay(1000);
}
