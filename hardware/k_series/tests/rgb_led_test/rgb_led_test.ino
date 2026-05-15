#include <Arduino.h>

constexpr uint8_t RED_PIN = 16;
constexpr uint8_t GREEN_PIN = 17;
constexpr uint8_t BLUE_PIN = 18;

// Set this to true if the RGB LED is common anode.
constexpr bool COMMON_ANODE = false;

constexpr uint8_t RED_CHANNEL = 0;
constexpr uint8_t GREEN_CHANNEL = 1;
constexpr uint8_t BLUE_CHANNEL = 2;
constexpr uint32_t PWM_FREQUENCY = 5000;
constexpr uint8_t PWM_RESOLUTION = 8;

uint8_t ledValue(uint8_t value) {
  return COMMON_ANODE ? 255 - value : value;
}

void setRgb(uint8_t red, uint8_t green, uint8_t blue) {
  ledcWrite(RED_CHANNEL, ledValue(red));
  ledcWrite(GREEN_CHANNEL, ledValue(green));
  ledcWrite(BLUE_CHANNEL, ledValue(blue));
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  ledcSetup(RED_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(GREEN_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(BLUE_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);

  ledcAttachPin(RED_PIN, RED_CHANNEL);
  ledcAttachPin(GREEN_PIN, GREEN_CHANNEL);
  ledcAttachPin(BLUE_PIN, BLUE_CHANNEL);

  Serial.println();
  Serial.println("K series RGB LED test");
  Serial.println("Pins: R=IO16, G=IO17, B=IO18");
  Serial.println(COMMON_ANODE ? "Mode: common anode" : "Mode: common cathode");
}

void loop() {
  Serial.println("red");
  setRgb(255, 0, 0);
  delay(1000);

  Serial.println("green");
  setRgb(0, 255, 0);
  delay(1000);

  Serial.println("blue");
  setRgb(0, 0, 255);
  delay(1000);

  Serial.println("white");
  setRgb(255, 255, 255);
  delay(1000);

  Serial.println("off");
  setRgb(0, 0, 0);
  delay(1000);
}
