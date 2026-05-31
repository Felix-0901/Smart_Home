#include <Arduino.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_SGP30.h>
#include <U8g2lib.h>

constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t DHT_TYPE = DHT22;

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint8_t SGP30_ADDRESS = 0x58;

constexpr uint8_t MQ_ANALOG_PIN = 33;
constexpr uint8_t MQ_DIGITAL_PIN = 25;

constexpr uint8_t FLAME_ANALOG_PIN = 35;
constexpr uint8_t FLAME_DIGITAL_PIN = 26;

constexpr uint8_t CURRENT_ANALOG_PIN = 34;
constexpr bool CURRENT_SENSOR_CONNECTED = true;
constexpr float ACS712_SENSITIVITY_V_PER_A = 0.185;  // ACS712-05B. Use 0.100 for 20A, 0.066 for 30A modules.
constexpr float CURRENT_DIVIDER_RATIO = 20.0 / (10.0 + 20.0);  // OUT -> 10k -> GPIO34, GPIO34 -> 20k -> GND.
constexpr bool CURRENT_USE_EXPECTED_ZERO = true;
constexpr float ACS712_EXPECTED_ZERO_SENSOR_VOLTAGE = 2.500;
constexpr float CURRENT_NOISE_DEADBAND_A = 0.150;
constexpr bool INVERT_CHARGE_CURRENT_DIRECTION = true;

constexpr uint8_t RGB_RED_PIN = 16;
constexpr uint8_t RGB_GREEN_PIN = 17;
constexpr uint8_t RGB_BLUE_PIN = 18;

// Set this to true if the RGB LED is common anode.
constexpr bool RGB_COMMON_ANODE = false;

constexpr uint8_t RED_CHANNEL = 0;
constexpr uint8_t GREEN_CHANNEL = 1;
constexpr uint8_t BLUE_CHANNEL = 2;
constexpr uint32_t PWM_FREQUENCY = 5000;
constexpr uint8_t PWM_RESOLUTION = 8;

constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;
constexpr int MQ_ANALOG_DISCONNECTED_RAW = 0;
constexpr unsigned long LOOP_INTERVAL_MS = 2000;
constexpr uint8_t OLED_PAGE_COUNT = 6;
constexpr uint8_t CURRENT_READ_SAMPLE_COUNT = 16;
constexpr uint8_t CURRENT_ZERO_SAMPLE_COUNT = 80;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SGP30 sgp30;
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(
    U8G2_R0,
    U8X8_PIN_NONE
);

bool sgp30Available = false;
bool oledAvailable = false;
bool lastI2cHasOled = false;
String lastI2cAddresses = "none";
uint8_t oledPageIndex = 0;
float currentZeroSensorVoltage = 0.0;
float measuredCurrentZeroSensorVoltage = 0.0;

float adcToVoltage(int raw) {
  return raw * ESP32_ADC_VOLTAGE / ADC_MAX;
}

int readAnalogAverage(uint8_t pin, uint8_t sampleCount) {
  uint32_t total = 0;
  for (uint8_t i = 0; i < sampleCount; i++) {
    total += analogRead(pin);
    delay(2);
  }
  return total / sampleCount;
}

float adcVoltageToSensorVoltage(float adcVoltage) {
  return CURRENT_DIVIDER_RATIO > 0.0 ? adcVoltage / CURRENT_DIVIDER_RATIO : adcVoltage;
}

float sensorVoltageToCurrent(float sensorVoltage) {
  const float currentA = (sensorVoltage - currentZeroSensorVoltage) / ACS712_SENSITIVITY_V_PER_A;
  return INVERT_CHARGE_CURRENT_DIRECTION ? -currentA : currentA;
}

float applyCurrentDeadband(float currentA) {
  return fabs(currentA) < CURRENT_NOISE_DEADBAND_A ? 0.0 : currentA;
}

uint8_t ledValue(uint8_t value) {
  return RGB_COMMON_ANODE ? 255 - value : value;
}

void setRgb(uint8_t red, uint8_t green, uint8_t blue) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(RGB_RED_PIN, ledValue(red));
  ledcWrite(RGB_GREEN_PIN, ledValue(green));
  ledcWrite(RGB_BLUE_PIN, ledValue(blue));
#else
  ledcWrite(RED_CHANNEL, ledValue(red));
  ledcWrite(GREEN_CHANNEL, ledValue(green));
  ledcWrite(BLUE_CHANNEL, ledValue(blue));
#endif
}

void setupRgb() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(RGB_RED_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttach(RGB_GREEN_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttach(RGB_BLUE_PIN, PWM_FREQUENCY, PWM_RESOLUTION);
#else
  ledcSetup(RED_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(GREEN_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(BLUE_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);

  ledcAttachPin(RGB_RED_PIN, RED_CHANNEL);
  ledcAttachPin(RGB_GREEN_PIN, GREEN_CHANNEL);
  ledcAttachPin(RGB_BLUE_PIN, BLUE_CHANNEL);
#endif

  setRgb(0, 0, 255);
}

void runRgbSelfTest() {
  Serial.println("RGB self test: red");
  setRgb(255, 0, 0);
  delay(700);

  Serial.println("RGB self test: green");
  setRgb(0, 255, 0);
  delay(700);

  Serial.println("RGB self test: blue");
  setRgb(0, 0, 255);
  delay(700);

  Serial.println("RGB self test: white");
  setRgb(255, 255, 255);
  delay(700);

  Serial.println("RGB self test: off");
  setRgb(0, 0, 0);
  delay(500);
}

void drawOledText(uint8_t y, const String &text) {
  u8g2.drawStr(0, y, text.c_str());
}

const char *shortRgbStatus(const char *rgbStatus) {
  if (strcmp(rgbStatus, "red_flame_warning") == 0) {
    return "RED FLAME";
  }
  if (strcmp(rgbStatus, "yellow_gas_warning") == 0) {
    return "YELLOW GAS";
  }
  if (strcmp(rgbStatus, "purple_sensor_error") == 0) {
    return "PURPLE ERROR";
  }
  return "GREEN NORMAL";
}

void setupOled(bool oledFoundOnBus) {
  oledAvailable = oledFoundOnBus;
  if (!oledAvailable) {
    return;
  }

  u8g2.setI2CAddress(OLED_ADDRESS << 1);
  oledAvailable = u8g2.begin();
  if (!oledAvailable) {
    return;
  }

  u8g2.setContrast(180);
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  drawOledText(12, "M series booting");
  drawOledText(28, "OLED: OK");
  drawOledText(44, "I2C: GPIO21/22");
  drawOledText(60, "ADDR: 0x3C");
  u8g2.sendBuffer();
}

void drawOledReadings(
    bool dhtOk,
    float temperature,
    float humidity,
    float heatIndex,
    bool sgp30Ok,
    uint16_t eco2,
    uint16_t tvoc,
    int mqRaw,
    float mqVoltage,
    int mqDigital,
    bool gasDetected,
    int flameRaw,
    float flameVoltage,
    int flameDigital,
    bool flameDetected,
    int currentRaw,
    float currentAdcVoltage,
    float currentSensorVoltage,
    float chargeCurrentA,
    const char *rgbStatus
) {
  if (!oledAvailable) {
    return;
  }

  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x12_tf);
  drawOledText(10, String("M SERIES ") + String(oledPageIndex + 1) + "/" + String(OLED_PAGE_COUNT));

  switch (oledPageIndex) {
    case 0:
      drawOledText(24, "DHT22");
      if (dhtOk) {
        drawOledText(38, String("Temp: ") + String(temperature, 1) + " C");
        drawOledText(52, String("Humi: ") + String(humidity, 1) + " %");
        drawOledText(64, String("Heat: ") + String(heatIndex, 1) + " C");
      } else {
        drawOledText(42, "DHT read failed");
      }
      break;
    case 1:
      drawOledText(24, "GY-SGP30");
      if (sgp30Ok) {
        drawOledText(38, String("eCO2: ") + String(eco2) + " ppm");
        drawOledText(52, String("TVOC: ") + String(tvoc) + " ppb");
      } else {
        drawOledText(42, "SGP30 not ready");
      }
      drawOledText(64, String("I2C: ") + lastI2cAddresses);
      break;
    case 2:
      drawOledText(24, "MQ GAS");
      drawOledText(38, String("Raw: ") + String(mqRaw));
      drawOledText(52, String("Volt: ") + String(mqVoltage, 3) + " V");
      drawOledText(64, String("DO: ") + String(mqDigital) + " Gas: " + (gasDetected ? "YES" : "NO"));
      break;
    case 3:
      drawOledText(24, "FLAME");
      drawOledText(38, String("Raw: ") + String(flameRaw));
      drawOledText(52, String("Volt: ") + String(flameVoltage, 3) + " V");
      drawOledText(64, String("DO: ") + String(flameDigital) + " Fire: " + (flameDetected ? "YES" : "NO"));
      break;
    case 4:
      drawOledText(24, "CHARGE CURRENT");
      if (CURRENT_SENSOR_CONNECTED) {
        drawOledText(38, String("Raw: ") + String(currentRaw));
        drawOledText(52, String("OUT: ") + String(currentSensorVoltage, 3) + " V");
        drawOledText(64, String("I: ") + String(chargeCurrentA * 1000.0, 0) + " mA");
      } else {
        drawOledText(44, "ACS712 not wired");
      }
      break;
    default:
      drawOledText(24, "SYSTEM");
      drawOledText(38, String("RGB: ") + shortRgbStatus(rgbStatus));
      drawOledText(52, String("OLED: ") + (oledAvailable ? "OK" : "OFF"));
      drawOledText(64, String("ACS712: ") + (CURRENT_SENSOR_CONNECTED ? "OK" : "OFF"));
      break;
  }

  u8g2.sendBuffer();
  oledPageIndex = (oledPageIndex + 1) % OLED_PAGE_COUNT;
}

void calibrateCurrentZero() {
  if (!CURRENT_SENSOR_CONNECTED) {
    return;
  }

  const int zeroRaw = readAnalogAverage(CURRENT_ANALOG_PIN, CURRENT_ZERO_SAMPLE_COUNT);
  const float zeroAdcVoltage = adcToVoltage(zeroRaw);
  measuredCurrentZeroSensorVoltage = adcVoltageToSensorVoltage(zeroAdcVoltage);
  currentZeroSensorVoltage = CURRENT_USE_EXPECTED_ZERO
      ? ACS712_EXPECTED_ZERO_SENSOR_VOLTAGE
      : measuredCurrentZeroSensorVoltage;

  Serial.print("current_zero_raw=");
  Serial.print(zeroRaw);
  Serial.print(", current_zero_adc_voltage=");
  Serial.print(zeroAdcVoltage, 3);
  Serial.print(", measured_current_zero_sensor_voltage=");
  Serial.print(measuredCurrentZeroSensorVoltage, 3);
  Serial.print(", current_zero_sensor_voltage=");
  Serial.println(currentZeroSensorVoltage, 3);
}

bool scanI2cBus() {
  uint8_t foundCount = 0;
  bool foundSgp30 = false;
  String addressText = "";
  lastI2cHasOled = false;

  pinMode(I2C_SDA_PIN, INPUT_PULLUP);
  pinMode(I2C_SCL_PIN, INPUT_PULLUP);
  delay(10);

  Serial.print("i2c_idle_sda=");
  Serial.print(digitalRead(I2C_SDA_PIN));
  Serial.print(", i2c_idle_scl=");
  Serial.print(digitalRead(I2C_SCL_PIN));
  Serial.print(", i2c_addresses=");

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);

  for (uint8_t address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    const uint8_t error = Wire.endTransmission();

    if (error == 0) {
      if (address == SGP30_ADDRESS) {
        foundSgp30 = true;
      }
      if (address == OLED_ADDRESS) {
        lastI2cHasOled = true;
      }
      if (addressText.length() > 0) {
        addressText += "|";
      }
      String hexAddress = String(address, HEX);
      hexAddress.toUpperCase();
      addressText += "0x";
      if (address < 16) {
        addressText += "0";
      }
      addressText += hexAddress;
      foundCount++;
    }
  }

  if (foundCount == 0) {
    addressText = "none";
  }
  lastI2cAddresses = addressText;
  Serial.print(lastI2cAddresses);

  Serial.println();
  return foundSgp30;
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  setupRgb();
  runRgbSelfTest();

  pinMode(MQ_DIGITAL_PIN, INPUT);
  pinMode(FLAME_DIGITAL_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(FLAME_ANALOG_PIN, ADC_11db);
  analogSetPinAttenuation(CURRENT_ANALOG_PIN, ADC_11db);
  calibrateCurrentZero();

  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  Wire.setClock(100000);
  const bool i2cHasSgp30 = scanI2cBus();
  setupOled(lastI2cHasOled);
  if (i2cHasSgp30) {
    sgp30Available = sgp30.begin();
  }

  Serial.println();
  Serial.println("M series sensor read test");
  Serial.println("Reads DHT22, GY-SGP30, MQ AO/DO, flame AO/DO, RGB status, and OLED pages.");
  Serial.println("RGB status: green=normal, yellow=gas DO warning, red=flame DO warning, purple=sensor error, blue=startup");
  Serial.println("OLED pages: DHT22, GY-SGP30, MQ, flame, charge current, system status");
  Serial.printf("DHT22 data pin: GPIO%d\n", DHT_PIN);
  Serial.printf("I2C SDA/SCL: GPIO%d/GPIO%d\n", I2C_SDA_PIN, I2C_SCL_PIN);
  Serial.printf("MQ AO/DO: GPIO%d/GPIO%d\n", MQ_ANALOG_PIN, MQ_DIGITAL_PIN);
  Serial.printf("Flame AO/DO: GPIO%d/GPIO%d\n", FLAME_ANALOG_PIN, FLAME_DIGITAL_PIN);
  Serial.printf("RGB R/G/B: GPIO%d/GPIO%d/GPIO%d\n", RGB_RED_PIN, RGB_GREEN_PIN, RGB_BLUE_PIN);
  Serial.printf("Current sensor connected: %s\n", CURRENT_SENSOR_CONNECTED ? "yes" : "no");
  Serial.printf("ACS712 sensitivity V/A: %.3f\n", ACS712_SENSITIVITY_V_PER_A);
  Serial.printf("Current divider ratio: %.3f\n", CURRENT_DIVIDER_RATIO);
  Serial.printf("Invert charge current direction: %s\n", INVERT_CHARGE_CURRENT_DIRECTION ? "yes" : "no");
  Serial.printf("SGP30 available: %s\n", sgp30Available ? "yes" : "no");
  Serial.printf("OLED available: %s\n", oledAvailable ? "yes" : "no");
}

void loop() {
  const float humidity = dht.readHumidity();
  const float temperature = dht.readTemperature();
  const float heatIndex = dht.computeHeatIndex(temperature, humidity, false);
  const bool dhtOk = !isnan(humidity) && !isnan(temperature);

  const bool i2cHasSgp30 = scanI2cBus();
  if (!sgp30Available && i2cHasSgp30) {
    sgp30Available = sgp30.begin();
  }
  if (!oledAvailable && lastI2cHasOled) {
    setupOled(true);
  }

  const int mqRaw = analogRead(MQ_ANALOG_PIN);
  const int mqDigital = digitalRead(MQ_DIGITAL_PIN);
  const float mqVoltage = adcToVoltage(mqRaw);
  const bool gasAnalogOk = mqRaw != MQ_ANALOG_DISCONNECTED_RAW;
  const bool gasDetected = mqDigital == LOW;

  const int flameRaw = analogRead(FLAME_ANALOG_PIN);
  const int flameDigital = digitalRead(FLAME_DIGITAL_PIN);
  const float flameVoltage = adcToVoltage(flameRaw);
  const bool flameDetected = flameDigital == LOW;

  const int currentRaw = CURRENT_SENSOR_CONNECTED ? readAnalogAverage(CURRENT_ANALOG_PIN, CURRENT_READ_SAMPLE_COUNT) : -1;
  const float currentAdcVoltage = CURRENT_SENSOR_CONNECTED ? adcToVoltage(currentRaw) : 0.0;
  const float currentSensorVoltage = CURRENT_SENSOR_CONNECTED ? adcVoltageToSensorVoltage(currentAdcVoltage) : 0.0;
  const float rawChargeCurrentA = CURRENT_SENSOR_CONNECTED ? sensorVoltageToCurrent(currentSensorVoltage) : 0.0;
  const float chargeCurrentA = CURRENT_SENSOR_CONNECTED ? applyCurrentDeadband(rawChargeCurrentA) : 0.0;

  uint16_t eco2 = 0;
  uint16_t tvoc = 0;
  bool sgp30Ok = false;
  if (sgp30Available) {
    sgp30Ok = sgp30.IAQmeasure();
    if (sgp30Ok) {
      eco2 = sgp30.eCO2;
      tvoc = sgp30.TVOC;
    }
  }

  const bool sensorError = !dhtOk || !sgp30Available || !sgp30Ok || !gasAnalogOk;
  const char *rgbStatus = "green_normal";

  if (flameDetected) {
    setRgb(255, 0, 0);
    rgbStatus = "red_flame_warning";
  } else if (gasDetected) {
    setRgb(255, 180, 0);
    rgbStatus = "yellow_gas_warning";
  } else if (sensorError) {
    setRgb(180, 0, 255);
    rgbStatus = "purple_sensor_error";
  } else {
    setRgb(0, 255, 0);
    rgbStatus = "green_normal";
  }

  drawOledReadings(
      dhtOk,
      temperature,
      humidity,
      heatIndex,
      sgp30Ok,
      eco2,
      tvoc,
      mqRaw,
      mqVoltage,
      mqDigital,
      gasDetected,
      flameRaw,
      flameVoltage,
      flameDigital,
      flameDetected,
      currentRaw,
      currentAdcVoltage,
      currentSensorVoltage,
      chargeCurrentA,
      rgbStatus
  );

  Serial.print("dht_ok=");
  Serial.print(dhtOk ? "true" : "false");
  Serial.print(", temperature_c=");
  Serial.print(dhtOk ? String(temperature, 2) : "null");
  Serial.print(", humidity_percent=");
  Serial.print(dhtOk ? String(humidity, 2) : "null");
  Serial.print(", heat_index_c=");
  Serial.print(dhtOk ? String(heatIndex, 2) : "null");

  Serial.print(", sgp30_ok=");
  Serial.print(sgp30Ok ? "true" : "false");
  Serial.print(", eco2_ppm=");
  Serial.print(sgp30Ok ? String(eco2) : "null");
  Serial.print(", tvoc_ppb=");
  Serial.print(sgp30Ok ? String(tvoc) : "null");

  Serial.print(", mq_raw=");
  Serial.print(mqRaw);
  Serial.print(", mq_voltage=");
  Serial.print(mqVoltage, 3);
  Serial.print(", mq_analog_ok=");
  Serial.print(gasAnalogOk ? "true" : "false");
  Serial.print(", mq_do=");
  Serial.print(mqDigital);
  Serial.print(", gas_detected=");
  Serial.print(gasDetected ? "true" : "false");

  Serial.print(", flame_raw=");
  Serial.print(flameRaw);
  Serial.print(", flame_voltage=");
  Serial.print(flameVoltage, 3);
  Serial.print(", flame_do=");
  Serial.print(flameDigital);
  Serial.print(", flame_detected=");
  Serial.print(flameDetected ? "true" : "false");

  Serial.print(", rgb_status=");
  Serial.print(rgbStatus);
  Serial.print(", oled_ok=");
  Serial.print(oledAvailable ? "true" : "false");
  Serial.print(", oled_page=");
  Serial.print(oledPageIndex == 0 ? OLED_PAGE_COUNT : oledPageIndex);
  Serial.print(", current_connected=");
  Serial.print(CURRENT_SENSOR_CONNECTED ? "true" : "false");
  Serial.print(", current_raw=");
  Serial.print(CURRENT_SENSOR_CONNECTED ? String(currentRaw) : "null");
  Serial.print(", current_adc_voltage=");
  Serial.print(CURRENT_SENSOR_CONNECTED ? String(currentAdcVoltage, 3) : "null");
  Serial.print(", current_sensor_voltage=");
  Serial.print(CURRENT_SENSOR_CONNECTED ? String(currentSensorVoltage, 3) : "null");
  Serial.print(", current_zero_sensor_voltage=");
  Serial.print(CURRENT_SENSOR_CONNECTED ? String(currentZeroSensorVoltage, 3) : "null");
  Serial.print(", charge_current_raw_a=");
  Serial.print(CURRENT_SENSOR_CONNECTED ? String(rawChargeCurrentA, 3) : "null");
  Serial.print(", charge_current_a=");
  Serial.print(CURRENT_SENSOR_CONNECTED ? String(chargeCurrentA, 3) : "null");
  Serial.print(", charge_current_ma=");
  Serial.println(CURRENT_SENSOR_CONNECTED ? String(chargeCurrentA * 1000.0, 0) : "null");

  delay(LOOP_INTERVAL_MS);
}
