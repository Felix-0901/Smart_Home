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

constexpr float ADC_MAX = 4095.0;
constexpr float ESP32_ADC_VOLTAGE = 3.3;
constexpr int MQ_ANALOG_DISCONNECTED_RAW = 0;
constexpr unsigned long LOOP_INTERVAL_MS = 2000;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SGP30 sgp30;
bool sgp30Available = false;

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(MQ_DIGITAL_PIN, INPUT);

  analogReadResolution(12);
  analogSetPinAttenuation(MQ_ANALOG_PIN, ADC_11db);

  dht.begin();
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  sgp30Available = sgp30.begin();

  Serial.println();
  Serial.println("R series sensor read test");
  Serial.println("Reads DHT22, GY-SGP30, and MQ only. RGB LED is not controlled.");
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

  Serial.print(", gas_raw=");
  Serial.print(gasRaw);
  Serial.print(", gas_voltage=");
  Serial.print(gasVoltage, 3);
  Serial.print(", gas_analog_ok=");
  Serial.print(gasAnalogOk ? "true" : "false");
  Serial.print(", gas_do=");
  Serial.print(gasDigital);
  Serial.print(", gas_detected=");
  Serial.println(gasDetected ? "true" : "false");

  delay(LOOP_INTERVAL_MS);
}
