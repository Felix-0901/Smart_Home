#include <Arduino.h>
#include <Wire.h>

struct I2cPins {
  const char *label;
  uint8_t sda;
  uint8_t scl;
};

const I2cPins pinSets[] = {
  {"default_io21_io22", 21, 22},
  {"swap_io22_io21", 22, 21},
  {"io19_io23", 19, 23},
  {"io32_io33", 32, 33},
  {"io25_io26", 25, 26},
  {"io27_io26", 27, 26},
};

constexpr uint8_t STATUS_LED_PIN = 2;

uint8_t scanCurrentBus() {
  uint8_t foundCount = 0;

  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    uint8_t error = Wire.endTransmission();

    if (error == 0) {
      Serial.print(" found=0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.print(address, HEX);
      foundCount++;
    }
  }

  return foundCount;
}

void scanPinSet(const I2cPins &pins) {
  Wire.begin(pins.sda, pins.scl);
  Wire.setClock(100000);
  delay(100);

  Serial.print("scan ");
  Serial.print(pins.label);
  Serial.print(" SDA=GPIO");
  Serial.print(pins.sda);
  Serial.print(" SCL=GPIO");
  Serial.print(pins.scl);

  uint8_t foundCount = scanCurrentBus();
  if (foundCount == 0) {
    Serial.print(" no_devices");
  }

  Serial.println();
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);

  Serial.println();
  Serial.println("T series SGP30 I2C pin scan");
  Serial.println("Expected SGP30 address: 0x58");
}

void loop() {
  for (const I2cPins &pins : pinSets) {
    scanPinSet(pins);
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    delay(500);
  }

  Serial.println("---");
  delay(2000);
}
