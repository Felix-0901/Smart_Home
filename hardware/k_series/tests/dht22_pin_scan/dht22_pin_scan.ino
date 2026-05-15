#include <Arduino.h>
#include <DHT.h>

constexpr uint8_t DHT_TYPE = DHT22;
constexpr uint8_t STATUS_LED_PIN = 2;

const uint8_t candidatePins[] = {
  0, 2, 4, 5, 16, 17, 18, 19,
  21, 22, 23, 25, 26, 27, 32, 33
};

bool readDhtOnPin(uint8_t pin) {
  DHT dht(pin, DHT_TYPE);
  dht.begin();

  delay(2200);

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  if (isnan(humidity) || isnan(temperature)) {
    Serial.print("GPIO");
    Serial.print(pin);
    Serial.println(": no reading");
    return false;
  }

  Serial.print("GPIO");
  Serial.print(pin);
  Serial.print(": temperature_c=");
  Serial.print(temperature, 2);
  Serial.print(", humidity_percent=");
  Serial.println(humidity, 2);

  return true;
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(STATUS_LED_PIN, OUTPUT);

  Serial.println();
  Serial.println("K series DHT22 pin scan");
  Serial.println("Expected sensor type: DHT22 / AM2302");
  Serial.println("Testing common ESP32 GPIO pins...");
}

void loop() {
  bool found = false;

  for (uint8_t i = 0; i < sizeof(candidatePins); i++) {
    found = readDhtOnPin(candidatePins[i]) || found;
  }

  if (found) {
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    Serial.println("DHT22 reading found. Use the GPIO above in k_series.ino.");
  } else {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("No DHT22 reading found. Check VCC, GND, DATA, and pull-up resistor.");
  }

  Serial.println("---");
  delay(3000);
}
