#include <Arduino.h>

struct PinCandidate {
  uint8_t pin;
  const char *label;
};

constexpr PinCandidate CANDIDATES[] = {
    {A0, "A0 / D0 / GPIO2"},
    {A1, "A1 / D1 / GPIO3"},
    {A2, "A2 / D2 / GPIO4"},
    {D3, "D3 / GPIO5"},
    {D4, "D4 / SDA / GPIO6"},
    {D5, "D5 / SCL / GPIO7"},
    {D6, "D6 / TX / GPIO21"},
    {D7, "D7 / RX / GPIO20"},
    {D8, "D8 / SCK / GPIO8"},
    {D9, "D9 / MISO / GPIO9"},
    {D10, "D10 / MOSI / GPIO10"},
};

constexpr uint8_t CURRENT_PIN = A1;
constexpr uint32_t SETTLE_MS = 200;
constexpr uint32_t HOLD_MS = 3000;

void releaseAllPins() {
  for (const PinCandidate &candidate : CANDIDATES) {
    pinMode(candidate.pin, INPUT);
  }
}

void printSample(const char *phase, const PinCandidate &candidate) {
  Serial.print(phase);
  Serial.print(" | testing ");
  Serial.print(candidate.label);
  Serial.print(" | pin=");
  Serial.print(candidate.pin);
  Serial.print(" | read=");
  Serial.print(digitalRead(candidate.pin));
  Serial.print(" | A1 raw=");
  Serial.println(analogRead(CURRENT_PIN));
}

void driveAndSample(const PinCandidate &candidate, uint8_t level, const char *phase) {
  releaseAllPins();
  pinMode(candidate.pin, OUTPUT);
  digitalWrite(candidate.pin, level);
  delay(SETTLE_MS);

  for (uint8_t i = 0; i < 3; i++) {
    printSample(phase, candidate);
    delay(HOLD_MS / 3);
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  releaseAllPins();
  pinMode(CURRENT_PIN, INPUT);

  Serial.println();
  Serial.println("P series pin sweep test");
  Serial.println("Each candidate pin is driven HIGH for 3s, then LOW for 3s.");
  Serial.println("Listen for the relay click or watch the relay indicator LED during each printed pin.");
  Serial.print("A0 resolves to GPIO ");
  Serial.println(A0);
  Serial.print("A1 resolves to GPIO ");
  Serial.println(A1);
}

void loop() {
  for (const PinCandidate &candidate : CANDIDATES) {
    Serial.println();
    Serial.print("==== Testing ");
    Serial.print(candidate.label);
    Serial.println(" ====");

    driveAndSample(candidate, HIGH, "HIGH");
    driveAndSample(candidate, LOW, "LOW");
  }

  releaseAllPins();
  Serial.println();
  Serial.println("==== Sweep complete, restarting in 3s ====");
  delay(3000);
}
