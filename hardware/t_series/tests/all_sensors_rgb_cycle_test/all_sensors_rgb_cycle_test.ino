#include <Arduino.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_SGP30.h>

constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t DHT_TYPE = DHT22;

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;

constexpr uint8_t MQ_ANALOG_PIN = 33;
constexpr uint8_t MQ_DIGITAL_PIN = 25;

constexpr uint8_t PIR_PIN = 27;

constexpr uint8_t RGB_RED_PIN = 16;
constexpr uint8_t RGB_GREEN_PIN = 17;
constexpr uint8_t RGB_BLUE_PIN = 18;
constexpr bool RGB_COMMON_ANODE = false;

constexpr uint8_t RED_CHANNEL = 0;
constexpr uint8_t GREEN_CHANNEL = 1;
constexpr uint8_t BLUE_CHANNEL = 2;
constexpr uint32_t PWM_FREQUENCY = 5000;
constexpr uint8_t PWM_RESOLUTION = 8;

constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;
constexpr unsigned long SAMPLE_INTERVAL_MS = 2000;
constexpr unsigned long PIR_SAMPLE_INTERVAL_MS = 20;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SGP30 sgp30;

bool sgp30Available = false;
bool motionLatched = false;
uint8_t rgbStep = 0;
unsigned long lastSampleAt = 0;
unsigned long lastPirSampleAt = 0;

uint8_t ledValue(uint8_t value) {
  return RGB_COMMON_ANODE ? 255 - value : value;
}

void setRgb(uint8_t red, uint8_t green, uint8_t blue) {
  ledcWrite(RED_CHANNEL, ledValue(red));
  ledcWrite(GREEN_CHANNEL, ledValue(green));
  ledcWrite(BLUE_CHANNEL, ledValue(blue));
}

const char *advanceRgbCycle() {
  if (rgbStep == 0) {
    setRgb(255, 0, 0);
    rgbStep = 1;
    return "red";
  }

  if (rgbStep == 1) {
    setRgb(0, 255, 0);
    rgbStep = 2;
    return "green";
  }

  setRgb(0, 0, 255);
  rgbStep = 0;
  return "blue";
}

void setupRgb() {
  ledcSetup(RED_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(GREEN_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcSetup(BLUE_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);

  ledcAttachPin(RGB_RED_PIN, RED_CHANNEL);
  ledcAttachPin(RGB_GREEN_PIN, GREEN_CHANNEL);
  ledcAttachPin(RGB_BLUE_PIN, BLUE_CHANNEL);

  setRgb(255, 0, 0);
}

void samplePir() {
  if (digitalRead(PIR_PIN) == HIGH) {
    motionLatched = true;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(MQ_DIGITAL_PIN, INPUT);
  pinMode(PIR_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);

  setupRgb();
  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  sgp30Available = sgp30.begin();

  Serial.println();
  Serial.println("T series all sensors + RGB cycle test");
  Serial.println("RGB cycle: red -> green -> blue");
  Serial.println("Pins: DHT22=GPIO4, MQ AO=GPIO33, MQ DO=GPIO25, SR501=GPIO27, SGP30 SDA=GPIO21 SCL=GPIO22, RGB R/G/B=GPIO16/17/18");
  Serial.printf("SGP30 available: %s\n", sgp30Available ? "yes" : "no");
}

void loop() {
  unsigned long now = millis();

  if (now - lastPirSampleAt >= PIR_SAMPLE_INTERVAL_MS) {
    samplePir();
    lastPirSampleAt = now;
  }

  if (now - lastSampleAt < SAMPLE_INTERVAL_MS) {
    delay(1);
    return;
  }

  lastSampleAt = now;

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  float heatIndex = dht.computeHeatIndex(temperature, humidity, false);
  bool dhtOk = !isnan(humidity) && !isnan(temperature);

  int gasRaw = analogRead(MQ_ANALOG_PIN);
  int gasDigital = digitalRead(MQ_DIGITAL_PIN);
  float gasVoltage = gasRaw * ESP32_ADC_VOLTAGE / ADC_MAX;
  bool gasAnalogOk = gasRaw != 0;
  bool gasDetected = gasDigital == LOW;

  int pirLevel = digitalRead(PIR_PIN);
  bool motionDetected = motionLatched || pirLevel == HIGH;

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

  const char *rgbColor = advanceRgbCycle();

  Serial.print("rgb_color=");
  Serial.print(rgbColor);
  Serial.print(", dht_ok=");
  Serial.print(dhtOk ? "true" : "false");
  Serial.print(", temperature_c=");
  Serial.print(dhtOk ? String(temperature, 2) : "null");
  Serial.print(", humidity_percent=");
  Serial.print(dhtOk ? String(humidity, 2) : "null");
  Serial.print(", heat_index_c=");
  Serial.print(dhtOk ? String(heatIndex, 2) : "null");

  Serial.print(", gas_raw=");
  Serial.print(gasRaw);
  Serial.print(", gas_voltage=");
  Serial.print(gasVoltage, 3);
  Serial.print(", gas_analog_ok=");
  Serial.print(gasAnalogOk ? "true" : "false");
  Serial.print(", gas_do=");
  Serial.print(gasDigital);
  Serial.print(", gas_detected=");
  Serial.print(gasDetected ? "true" : "false");

  Serial.print(", pir_level=");
  Serial.print(pirLevel);
  Serial.print(", motion_detected=");
  Serial.print(motionDetected ? "true" : "false");
  Serial.print(", motion_latched=");
  Serial.print(motionLatched ? "true" : "false");

  Serial.print(", sgp30_ok=");
  Serial.print(sgp30Ok ? "true" : "false");
  Serial.print(", eco2_ppm=");
  Serial.print(sgp30Ok ? String(eco2) : "null");
  Serial.print(", tvoc_ppb=");
  Serial.println(sgp30Ok ? String(tvoc) : "null");

  motionLatched = digitalRead(PIR_PIN) == HIGH;
}
