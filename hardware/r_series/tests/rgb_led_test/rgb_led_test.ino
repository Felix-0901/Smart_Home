#include <Arduino.h>

constexpr uint8_t RED_PIN = 16;
constexpr uint8_t GREEN_PIN = 17;
constexpr uint8_t BLUE_PIN = 18;

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
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(RED_PIN, ledValue(red));
  ledcWrite(GREEN_PIN, ledValue(green));
  ledcWrite(BLUE_PIN, ledValue(blue));
#else
  ledcWrite(RED_CHANNEL, ledValue(red));
  ledcWrite(GREEN_CHANNEL, ledValue(green));
  ledcWrite(BLUE_CHANNEL, ledValue(blue));
#endif
}

void setup() {
  Serial.begin(115200);
  delay(1000);

#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(RED_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttach(GREEN_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttach(BLUE_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
#else
  ledcSetup(RED_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(GREEN_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(BLUE_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);

  ledcAttachPin(RED_PIN, RED_CHANNEL);
  ledcAttachPin(GREEN_PIN, GREEN_CHANNEL);
  ledcAttachPin(BLUE_PIN, BLUE_CHANNEL);
#endif

  Serial.println();
  Serial.println("R series RGB LED test");
  Serial.println("Pins: R=GPIO16, G=GPIO17, B=GPIO18");
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
}
