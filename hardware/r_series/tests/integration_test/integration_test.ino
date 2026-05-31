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
constexpr int MQ_ANALOG_DISCONNECTED_RAW = 0;
constexpr unsigned long LOOP_INTERVAL_MS = 2000;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SGP30 sgp30;
bool sgp30Available = false;

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

  Serial.println("RGB self test: off");
  setRgb(0, 0, 0);
  delay(500);
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  setupRgb();
  runRgbSelfTest();

  pinMode(MQ_DIGITAL_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);

  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  sgp30Available = sgp30.begin();

  Serial.println();
  Serial.println("R series integration test");
  Serial.println("RGB status: green=normal, yellow=gas DO warning, purple=sensor error");
  Serial.printf("SGP30 available: %s\n", sgp30Available ? "yes" : "no");
}

void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  float heatIndex = dht.computeHeatIndex(temperature, humidity, false);
  bool dhtOk = !isnan(humidity) && !isnan(temperature);

  int gasRaw = analogRead(MQ_ANALOG_PIN);
  int gasDigital = digitalRead(MQ_DIGITAL_PIN);
  float gasVoltage = gasRaw * ESP32_ADC_VOLTAGE / ADC_MAX;
  bool gasAnalogOk = gasRaw != MQ_ANALOG_DISCONNECTED_RAW;
  bool gasDetected = gasDigital == LOW;

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

  bool sensorError = !dhtOk || !sgp30Available || !sgp30Ok || !gasAnalogOk;
  const char *rgbStatus = "green_normal";

  if (gasDetected) {
    setRgb(255, 180, 0);
    rgbStatus = "yellow_gas_warning";
  } else if (sensorError) {
    setRgb(180, 0, 255);
    rgbStatus = "purple_sensor_error";
  } else {
    setRgb(0, 255, 0);
    rgbStatus = "green_normal";
  }

  Serial.print("dht_ok=");
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
  Serial.print(", rgb_status=");
  Serial.print(rgbStatus);

  Serial.print(", sgp30_ok=");
  Serial.print(sgp30Ok ? "true" : "false");
  Serial.print(", eco2_ppm=");
  Serial.print(sgp30Ok ? String(eco2) : "null");
  Serial.print(", tvoc_ppb=");
  Serial.println(sgp30Ok ? String(tvoc) : "null");

  delay(LOOP_INTERVAL_MS);
}
