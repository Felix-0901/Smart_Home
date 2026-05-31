#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint32_t I2C_CLOCK_HZ = 100000;

U8G2_SSD1306_128X64_NONAME_F_HW_I2C ssd1306(
    U8G2_R0,
    U8X8_PIN_NONE
);

U8G2_SH1106_128X64_NONAME_F_HW_I2C sh1106(
    U8G2_R0,
    U8X8_PIN_NONE
);

bool scanI2c() {
  bool oledFound = false;
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
      if (address == OLED_ADDRESS) {
        oledFound = true;
      }
    }
  }

  if (foundCount == 0) {
    Serial.print("none");
  }
  Serial.println();
  return oledFound;
}

void drawFullWhite(U8G2 &display, const char *driverName) {
  Serial.print("show_full_white driver=");
  Serial.println(driverName);
  display.clearBuffer();
  display.drawBox(0, 0, 128, 64);
  display.sendBuffer();
  delay(1500);
}

void drawText(U8G2 &display, const char *driverName) {
  Serial.print("show_text driver=");
  Serial.println(driverName);
  display.clearBuffer();
  display.setFont(u8g2_font_9x15B_tf);
  display.drawStr(0, 15, driverName);
  display.drawStr(0, 34, "OLED CHECK");
  display.drawStr(0, 53, "ADDR 0x3C");
  display.sendBuffer();
  delay(2500);
}

void drawBorder(U8G2 &display, const char *driverName) {
  Serial.print("show_border driver=");
  Serial.println(driverName);
  display.clearBuffer();
  display.drawFrame(0, 0, 128, 64);
  display.drawFrame(4, 4, 120, 56);
  display.setFont(u8g2_font_6x12_tf);
  display.drawStr(12, 34, driverName);
  display.sendBuffer();
  delay(2000);
}

void clearDisplay(U8G2 &display, const char *driverName) {
  Serial.print("clear driver=");
  Serial.println(driverName);
  display.clearBuffer();
  display.sendBuffer();
  delay(700);
}

void setup() {
  Serial.begin(115200);
  delay(1200);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(I2C_CLOCK_HZ);

  Serial.println();
  Serial.println("M series OLED panel check");
  Serial.printf("SDA/SCL: GPIO%d/GPIO%d\n", I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.printf("Expected OLED address: 0x%02X\n", OLED_ADDRESS);

  const bool oledFound = scanI2c();
  Serial.printf("oled_found=%s\n", oledFound ? "true" : "false");

  ssd1306.setI2CAddress(OLED_ADDRESS << 1);
  sh1106.setI2CAddress(OLED_ADDRESS << 1);

  const bool ssdStarted = ssd1306.begin();
  ssd1306.setContrast(255);
  Serial.printf("ssd1306_begin=%s\n", ssdStarted ? "true" : "false");

  const bool shStarted = sh1106.begin();
  sh1106.setContrast(255);
  Serial.printf("sh1106_begin=%s\n", shStarted ? "true" : "false");
}

void loop() {
  drawFullWhite(ssd1306, "SSD1306");
  drawText(ssd1306, "SSD1306");
  drawBorder(ssd1306, "SSD1306");
  clearDisplay(ssd1306, "SSD1306");

  drawFullWhite(sh1106, "SH1106");
  drawText(sh1106, "SH1106");
  drawBorder(sh1106, "SH1106");
  clearDisplay(sh1106, "SH1106");
}
