#include <Arduino.h>

constexpr uint8_t SWITCH_PIN = A0;
constexpr uint8_t CURRENT_PIN = A1;
constexpr uint32_t ON_MS = 2000;
constexpr uint32_t OFF_MS = 2000;

void printReading(const char *state) {
  const int currentRaw = analogRead(CURRENT_PIN);
  Serial.print(state);
  Serial.print(" | A0=");
  Serial.print(digitalRead(SWITCH_PIN));
  Serial.print(" | A1 raw=");
  Serial.println(currentRaw);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(SWITCH_PIN, OUTPUT);
  pinMode(CURRENT_PIN, INPUT);
  digitalWrite(SWITCH_PIN, LOW);

  Serial.println();
  Serial.println("P series output cycle test");
  Serial.print("Switch pin A0 resolved to pin number: ");
  Serial.println(SWITCH_PIN);
  Serial.print("Current sense pin A1 resolved to pin number: ");
  Serial.println(CURRENT_PIN);
  Serial.println("A0 cycles HIGH for 2s, then LOW for 2s. A1 raw value is printed each cycle.");
}

void loop() {
  digitalWrite(SWITCH_PIN, HIGH);
  printReading("ON");
  delay(ON_MS);

  digitalWrite(SWITCH_PIN, LOW);
  printReading("OFF");
  delay(OFF_MS);
}
