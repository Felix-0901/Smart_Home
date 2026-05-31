#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint32_t I2C_CLOCK_HZ = 100000;

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(
    U8G2_R0,
    U8X8_PIN_NONE
);

bool scanForAddress(uint8_t expectedAddress) {
  bool found = false;
  uint8_t foundCount = 0;

  Serial.print("i2c_addresses=");
  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    const uint8_t error = Wire.endTransmission();

    if (error == 0) {
      if (foundCount > 0) {
        Serial.print("|");
      }
      Serial.print("0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.print(address, HEX);
      foundCount++;

      if (address == expectedAddress) {
        found = true;
      }
    }
  }

  if (foundCount == 0) {
    Serial.print("none");
  }
  Serial.println();

  return found;
}

void drawScreen(uint32_t counter) {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  u8g2.drawStr(0, 12, "M series OLED");
  u8g2.drawStr(0, 27, "I2C: GPIO21/22");
  u8g2.drawStr(0, 42, "ADDR: 0x3C");

  char line[24];
  snprintf(line, sizeof(line), "COUNT: %lu", static_cast<unsigned long>(counter));
  u8g2.drawStr(0, 57, line);

  const uint8_t barWidth = 8 + (counter % 14) * 8;
  const uint8_t barFill = barWidth > 36 ? 36 : barWidth;
  u8g2.drawFrame(86, 49, 40, 10);
  u8g2.drawBox(88, 51, barFill, 6);
  u8g2.sendBuffer();
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(I2C_CLOCK_HZ);

  Serial.println();
  Serial.println("M series OLED display test");
  Serial.printf("SDA/SCL: GPIO%d/GPIO%d\n", I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.printf("Expected OLED address: 0x%02X\n", OLED_ADDRESS);

  const bool oledFound = scanForAddress(OLED_ADDRESS);
  Serial.printf("oled_found=%s\n", oledFound ? "true" : "false");

  u8g2.setI2CAddress(OLED_ADDRESS << 1);
  const bool displayStarted = u8g2.begin();
  Serial.printf("u8g2_begin=%s\n", displayStarted ? "true" : "false");

  u8g2.setContrast(180);
}

void loop() {
  static uint32_t counter = 0;

  drawScreen(counter++);
  Serial.println("oled_frame_sent=true");
  delay(1000);
}
