#include <Arduino.h>
#include <DHT.h>

constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t DHT_TYPE = DHT22;
constexpr uint8_t STATUS_LED_PIN = 2;

DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);
  dht.begin();

  Serial.println();
  Serial.println("K series DHT22 test");
  Serial.println("Expected wiring: VCC=3V3, GND=GND, OUT=GPIO4");
}

void loop() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("DHT22 read failed. Check VCC/GND/OUT wiring and GPIO pin.");
    digitalWrite(STATUS_LED_PIN, LOW);
  } else {
    float heatIndex = dht.computeHeatIndex(temperature, humidity, false);

    Serial.print("temperature_c=");
    Serial.print(temperature, 2);
    Serial.print(", humidity_percent=");
    Serial.print(humidity, 2);
    Serial.print(", heat_index_c=");
    Serial.println(heatIndex, 2);

    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  }

  delay(2000);
}
