#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_SGP30.h>

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t STATUS_LED_PIN = 2;

Adafruit_SGP30 sgp30;
bool sgp30Available = false;
unsigned long lastScanAt = 0;

uint8_t scanI2cBus() {
  uint8_t foundCount = 0;

  Serial.println("Scanning I2C bus...");
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    uint8_t error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device found at 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.println(address, HEX);
      foundCount++;
    }
  }

  if (foundCount == 0) {
    Serial.println("No I2C devices found on SDA=GPIO21, SCL=GPIO22.");
  }

  return foundCount;
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  Serial.println();
  Serial.println("T series GY-SGP30 test");
  Serial.println("Expected wiring: VCC=3V3, GND=GND, SDA=GPIO21, SCL=GPIO22");
  scanI2cBus();

  sgp30Available = sgp30.begin();
  if (!sgp30Available) {
    Serial.println("SGP30 not found. Check VCC/GND/SDA/SCL wiring.");
    return;
  }

  Serial.print("SGP30 serial #");
  Serial.print(sgp30.serialnumber[0], HEX);
  Serial.print(sgp30.serialnumber[1], HEX);
  Serial.println(sgp30.serialnumber[2], HEX);
}

void loop() {
  if (!sgp30Available) {
    Serial.println("SGP30 not found. Check VCC/GND/SDA/SCL wiring.");
    if (millis() - lastScanAt >= 5000) {
      scanI2cBus();
      lastScanAt = millis();
    }
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    delay(1000);
    return;
  }

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
