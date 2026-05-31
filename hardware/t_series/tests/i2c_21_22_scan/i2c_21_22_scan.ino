#include <Arduino.h>
#include <Wire.h>

constexpr uint8_t SDA_PIN = 21;
constexpr uint8_t SCL_PIN = 22;
constexpr uint8_t STATUS_LED_PIN = 2;

void scanI2cBus() {
  uint8_t foundCount = 0;

  pinMode(SDA_PIN, INPUT_PULLUP);
  pinMode(SCL_PIN, INPUT_PULLUP);
  delay(10);
  Serial.print("idle_levels sda=");
  Serial.print(digitalRead(SDA_PIN));
  Serial.print(", scl=");
  Serial.println(digitalRead(SCL_PIN));

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  Serial.println("I2C scan on SDA=GPIO21, SCL=GPIO22");

  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    uint8_t error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("found address 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.println(address, HEX);
      foundCount++;
    }
  }

  if (foundCount == 0) {
    Serial.println("no_i2c_devices_found");
  }

  Serial.println("---");
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);

  // Keep weak pull-ups enabled during diagnosis. Real I2C modules usually
  // include pull-ups, but this makes a missing-pull-up case easier to catch.
  pinMode(SDA_PIN, INPUT_PULLUP);
  pinMode(SCL_PIN, INPUT_PULLUP);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);

  Serial.println();
  Serial.println("T series minimal I2C scanner");
  Serial.println("Expected GY-SGP30 address: 0x58");
}

void loop() {
  scanI2cBus();
  digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  delay(2000);
}
