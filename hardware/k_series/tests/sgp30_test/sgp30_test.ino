#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_SGP30.h>

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t STATUS_LED_PIN = 2;

Adafruit_SGP30 sgp30;

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  Serial.println();
  Serial.println("K series GY-SGP30 test");
  Serial.println("Expected wiring: VCC=3V3, GND=GND, SDA=IO21, SCL=IO22");

  if (!sgp30.begin()) {
    Serial.println("SGP30 not found. Check VCC/GND/SDA/SCL wiring.");
    while (true) {
      digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
      delay(250);
    }
  }

  Serial.print("SGP30 serial #");
  Serial.print(sgp30.serialnumber[0], HEX);
  Serial.print(sgp30.serialnumber[1], HEX);
  Serial.println(sgp30.serialnumber[2], HEX);
}

void loop() {
  if (!sgp30.IAQmeasure()) {
    Serial.println("SGP30 measurement failed.");
    delay(1000);
    return;
  }

  Serial.print("eco2_ppm=");
  Serial.print(sgp30.eCO2);
  Serial.print(", tvoc_ppb=");
  Serial.println(sgp30.TVOC);

  digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  delay(1000);
}
