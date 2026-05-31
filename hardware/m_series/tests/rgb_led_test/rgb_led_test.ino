#include <Arduino.h>

constexpr uint8_t RGB_RED_PIN = 16;
constexpr uint8_t RGB_GREEN_PIN = 17;
constexpr uint8_t RGB_BLUE_PIN = 18;

void setPins(uint8_t red, uint8_t green, uint8_t blue) {
  digitalWrite(RGB_RED_PIN, red);
  digitalWrite(RGB_GREEN_PIN, green);
  digitalWrite(RGB_BLUE_PIN, blue);
}

void showStep(const char *label, uint8_t red, uint8_t green, uint8_t blue) {
  Serial.println(label);
  setPins(red, green, blue);
  delay(1200);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RGB_RED_PIN, OUTPUT);
  pinMode(RGB_GREEN_PIN, OUTPUT);
  pinMode(RGB_BLUE_PIN, OUTPUT);
  setPins(LOW, LOW, LOW);

  Serial.println();
  Serial.println("M series RGB LED direct GPIO test");
  Serial.printf("R/G/B pins: GPIO%d/GPIO%d/GPIO%d\n", RGB_RED_PIN, RGB_GREEN_PIN, RGB_BLUE_PIN);
  Serial.println("First pass assumes common cathode: common pin to GND, color pins turn on with HIGH.");
  Serial.println("Second pass assumes common anode: common pin to 3V3, color pins turn on with LOW.");
}

void loop() {
  Serial.println("common cathode test");
  showStep("red HIGH", HIGH, LOW, LOW);
  showStep("green HIGH", LOW, HIGH, LOW);
  showStep("blue HIGH", LOW, LOW, HIGH);
  showStep("white HIGH", HIGH, HIGH, HIGH);
  showStep("off LOW", LOW, LOW, LOW);

  delay(800);

  Serial.println("common anode test");
  showStep("red LOW", LOW, HIGH, HIGH);
  showStep("green LOW", HIGH, LOW, HIGH);
  showStep("blue LOW", HIGH, HIGH, LOW);
  showStep("white LOW", LOW, LOW, LOW);
  showStep("off HIGH", HIGH, HIGH, HIGH);

  delay(1200);
}
