#include <Arduino.h>

struct PinSpec {
  uint8_t gpio;
  const char *silkscreen;
  bool canRead;
  bool canOutput;
  bool hasInternalPull;
  bool canAdc;
  const char *note;
};

const PinSpec PINS[] = {
    {0, "IO0", true, false, true, true, "boot strapping; read only in this test"},
    {1, "TXD", true, false, true, false, "USB serial TX; do not use while monitoring"},
    {2, "IO2", true, false, true, true, "boot strapping / often built-in LED"},
    {3, "RXD", true, false, true, false, "USB serial RX; do not use while monitoring"},
    {4, "IO4", true, true, true, true, "safe output when wiring is confirmed"},
    {5, "IO5", true, false, true, true, "boot strapping; read only in this test"},
    {12, "IO12", true, false, true, true, "boot strapping; read only in this test"},
    {13, "IO13", true, true, true, true, "safe output when wiring is confirmed"},
    {14, "IO14", true, true, true, true, "safe output when wiring is confirmed"},
    {15, "IO15", true, false, true, true, "boot strapping; read only in this test"},
    {16, "IO16", true, true, true, false, "safe output when wiring is confirmed"},
    {17, "IO17", true, true, true, false, "safe output when wiring is confirmed"},
    {18, "IO18", true, true, true, false, "safe output when wiring is confirmed"},
    {19, "IO19", true, true, true, false, "safe output when wiring is confirmed"},
    {21, "IO21", true, true, true, false, "I2C SDA candidate"},
    {22, "IO22", true, true, true, false, "I2C SCL candidate"},
    {23, "IO23", true, true, true, false, "safe output when wiring is confirmed"},
    {25, "IO25", true, true, true, true, "ADC2; safe output when wiring is confirmed"},
    {26, "IO26", true, true, true, true, "ADC2; safe output when wiring is confirmed"},
    {27, "IO27", true, true, true, true, "ADC2; safe output when wiring is confirmed"},
    {32, "IO32", true, true, true, true, "ADC1; safe output when wiring is confirmed"},
    {33, "IO33", true, true, true, true, "ADC1; safe output when wiring is confirmed"},
    {34, "IO34", true, false, false, true, "input only; no internal pull"},
    {35, "IO35", true, false, false, true, "input only; no internal pull"},
    {36, "SVP/IO36", true, false, false, true, "input only; no internal pull"},
    {39, "SVN/IO39", true, false, false, true, "input only; no internal pull"},
};

constexpr uint32_t BAUD_RATE = 115200;
constexpr uint16_t SETTLE_MS = 8;
constexpr uint16_t OUTPUT_HIGH_MS = 900;
constexpr uint16_t OUTPUT_LOW_MS = 300;

void printHeader() {
  Serial.println();
  Serial.println("=== T series ESP32 GPIO self test ===");
  Serial.println("Default scan does not drive pins HIGH.");
  Serial.println("Commands:");
  Serial.println("  s    run passive scan again");
  Serial.println("  w    walk safe output pins; measure each pin with LED+resistor or multimeter");
  Serial.println("  oNN  drive one safe output pin, example o16");
  Serial.println();
}

void passiveScan() {
  Serial.println("gpio,silk,base,pullup,pulldown,adc_raw,result,note");

  for (const PinSpec &pin : PINS) {
    int base = -1;
    int pullup = -1;
    int pulldown = -1;
    int adcRaw = -1;
    const char *result = "check";

    if (pin.canRead) {
      pinMode(pin.gpio, INPUT);
      delay(SETTLE_MS);
      base = digitalRead(pin.gpio);

      if (pin.hasInternalPull) {
        pinMode(pin.gpio, INPUT_PULLUP);
        delay(SETTLE_MS);
        pullup = digitalRead(pin.gpio);

        pinMode(pin.gpio, INPUT_PULLDOWN);
        delay(SETTLE_MS);
        pulldown = digitalRead(pin.gpio);

        if (pullup == HIGH && pulldown == LOW) {
          result = "internal_pull_ok";
        } else if (pullup == HIGH && pulldown == HIGH) {
          result = "externally_high_or_stuck_high";
        } else if (pullup == LOW && pulldown == LOW) {
          result = "externally_low_or_stuck_low";
        } else {
          result = "unstable_or_connected";
        }
      } else {
        result = "input_only_external_check_required";
      }
    }

    if (pin.canAdc) {
      adcRaw = analogRead(pin.gpio);
    }

    pinMode(pin.gpio, INPUT);

    Serial.printf(
        "GPIO%u,%s,%d,%d,%d,%d,%s,%s\n",
        pin.gpio,
        pin.silkscreen,
        base,
        pullup,
        pulldown,
        adcRaw,
        result,
        pin.note);
  }

  Serial.println("Passive scan done.");
  Serial.println();
}

const PinSpec *findPin(uint8_t gpio) {
  for (const PinSpec &pin : PINS) {
    if (pin.gpio == gpio) {
      return &pin;
    }
  }
  return nullptr;
}

void driveOne(const PinSpec &pin) {
  if (!pin.canOutput) {
    Serial.printf("GPIO%u is not enabled for output in this safety test: %s\n", pin.gpio, pin.note);
    return;
  }

  Serial.printf("OUTPUT GPIO%u (%s) HIGH now. Measure about 3.3V.\n", pin.gpio, pin.silkscreen);
  pinMode(pin.gpio, OUTPUT);
  digitalWrite(pin.gpio, HIGH);
  delay(OUTPUT_HIGH_MS);
  Serial.printf("OUTPUT GPIO%u (%s) LOW now. Measure about 0V.\n", pin.gpio, pin.silkscreen);
  digitalWrite(pin.gpio, LOW);
  delay(OUTPUT_LOW_MS);
  pinMode(pin.gpio, INPUT);
}

void walkOutputs() {
  Serial.println("Starting safe output walk.");
  Serial.println("Only GPIOs marked safe output are driven. Disconnect sensors first if unsure.");

  for (const PinSpec &pin : PINS) {
    if (pin.canOutput) {
      driveOne(pin);
    }
  }

  Serial.println("Output walk done.");
  Serial.println();
}

void handleCommand(String command) {
  command.trim();
  command.toLowerCase();

  if (command == "s") {
    passiveScan();
    return;
  }

  if (command == "w") {
    walkOutputs();
    return;
  }

  if (command.startsWith("o")) {
    int gpio = command.substring(1).toInt();
    const PinSpec *pin = findPin(static_cast<uint8_t>(gpio));
    if (pin == nullptr) {
      Serial.printf("GPIO%d is not in the test list.\n", gpio);
      return;
    }
    driveOne(*pin);
    return;
  }

  Serial.println("Unknown command. Use s, w, or oNN.");
}

void setup() {
  Serial.begin(BAUD_RATE);
  delay(1500);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  printHeader();
  passiveScan();
}

void loop() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    handleCommand(command);
  }
}
