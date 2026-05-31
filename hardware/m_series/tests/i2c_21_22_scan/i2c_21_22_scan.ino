#include <Arduino.h>
#include <Wire.h>

constexpr uint8_t SDA_PIN = 21;
constexpr uint8_t SCL_PIN = 22;
constexpr uint32_t I2C_CLOCK_HZ = 100000;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint8_t SGP30_ADDRESS = 0x58;

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
  Wire.setClock(I2C_CLOCK_HZ);

  Serial.println("I2C scan on SDA=GPIO21, SCL=GPIO22");
  Serial.printf("Expected OLED address: 0x%02X\n", OLED_ADDRESS);
  Serial.printf("Expected GY-SGP30 address: 0x%02X\n", SGP30_ADDRESS);

  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    const uint8_t error = Wire.endTransmission();

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

  pinMode(SDA_PIN, INPUT_PULLUP);
  pinMode(SCL_PIN, INPUT_PULLUP);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(I2C_CLOCK_HZ);

  Serial.println();
  Serial.println("M series minimal I2C scanner");
}

void loop() {
  scanI2cBus();
  delay(2000);
}
