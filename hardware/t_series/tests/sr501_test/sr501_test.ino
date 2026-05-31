#include <Arduino.h>

constexpr uint8_t PIR_PIN = 27;
constexpr uint8_t BUILTIN_LED_PIN = 2;
constexpr unsigned long SAMPLE_INTERVAL_MS = 5;
constexpr unsigned long PRINT_INTERVAL_MS = 100;
constexpr unsigned long LINE_PROBE_INTERVAL_MS = 1000;

int lastPirLevel = LOW;
unsigned long transitionCount = 0;
unsigned long highSampleCount = 0;
unsigned long lowSampleCount = 0;
unsigned long floatingSampleCount = 0;
unsigned long drivenLowSampleCount = 0;
unsigned long drivenHighSampleCount = 0;
unsigned long motionStartedAt = 0;
unsigned long lastSampleAt = 0;
unsigned long lastPrintAt = 0;
unsigned long lastLineProbeAt = 0;

int currentPirLevel = LOW;
const char *lastLineState = "not_checked";

struct PinProbe {
  int pulldownLevel;
  int pullupLevel;
  int stableLevel;
  const char *state;
};

PinProbe probePirPin() {
  pinMode(PIR_PIN, INPUT_PULLDOWN);
  delayMicroseconds(250);
  int pulldownLevel = digitalRead(PIR_PIN);

  pinMode(PIR_PIN, INPUT_PULLUP);
  delayMicroseconds(250);
  int pullupLevel = digitalRead(PIR_PIN);

  if (pulldownLevel == LOW && pullupLevel == HIGH) {
    return {pulldownLevel, pullupLevel, LOW, "floating_or_disconnected"};
  }

  if (pulldownLevel == LOW && pullupLevel == LOW) {
    return {pulldownLevel, pullupLevel, LOW, "externally_driven_low"};
  }

  if (pulldownLevel == HIGH && pullupLevel == HIGH) {
    return {pulldownLevel, pullupLevel, HIGH, "externally_driven_high"};
  }

  return {pulldownLevel, pullupLevel, LOW, "unstable"};
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  pinMode(BUILTIN_LED_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT_PULLDOWN);
  digitalWrite(BUILTIN_LED_PIN, LOW);
  PinProbe initialProbe = probePirPin();
  lastLineState = initialProbe.state;
  pinMode(PIR_PIN, INPUT_PULLDOWN);

  currentPirLevel = digitalRead(PIR_PIN);
  lastPirLevel = currentPirLevel;
  if (lastPirLevel == HIGH) {
    motionStartedAt = millis();
  }

  Serial.println();
  Serial.println("T series SR501 PIR diagnostic test");
  Serial.println("Expected wiring: VCC=5V/VIN, GND=GND, OUT=GPIO27");
  Serial.println("Built-in LED: ON when motion is detected, OFF when idle.");
  Serial.println("Warm-up: SR501 usually needs 30-60 seconds after power on.");
  Serial.println("Sample rate: GPIO27 is read every 5ms. Serial output is printed every 100ms.");
  Serial.println("Note: SR501 has no device ID. This test reads GPIO27 frequently and probes line state every 1 second.");
}

void loop() {
  unsigned long now = millis();

  if (now - lastSampleAt >= SAMPLE_INTERVAL_MS) {
    currentPirLevel = digitalRead(PIR_PIN);
    bool motionDetected = currentPirLevel == HIGH;

    if (currentPirLevel != lastPirLevel) {
      transitionCount++;
      lastPirLevel = currentPirLevel;
      if (motionDetected) {
        motionStartedAt = now;
      }

      Serial.print("CHANGE gpio27_level=");
      Serial.print(currentPirLevel);
      Serial.print(", motion_detected=");
      Serial.print(motionDetected ? "true" : "false");
      Serial.print(", transitions=");
      Serial.println(transitionCount);
    }

    if (motionDetected) {
      highSampleCount++;
    } else {
      lowSampleCount++;
    }

    digitalWrite(BUILTIN_LED_PIN, motionDetected ? HIGH : LOW);
    lastSampleAt = now;
  }

  if (now - lastLineProbeAt >= LINE_PROBE_INTERVAL_MS) {
    PinProbe probe = probePirPin();
    lastLineState = probe.state;
    pinMode(PIR_PIN, INPUT_PULLDOWN);

    if (strcmp(probe.state, "floating_or_disconnected") == 0) {
      floatingSampleCount++;
    } else if (strcmp(probe.state, "externally_driven_low") == 0) {
      drivenLowSampleCount++;
    } else if (strcmp(probe.state, "externally_driven_high") == 0) {
      drivenHighSampleCount++;
    }

    lastLineProbeAt = now;
  }

  if (now - lastPrintAt >= PRINT_INTERVAL_MS) {
    bool motionDetected = currentPirLevel == HIGH;
    unsigned long highDurationMs = motionDetected ? now - motionStartedAt : 0;

    Serial.print("gpio27_level=");
    Serial.print(currentPirLevel);
    Serial.print(", line_state=");
    Serial.print(lastLineState);
    Serial.print(", motion_detected=");
    Serial.print(motionDetected ? "true" : "false");
    Serial.print(", transitions=");
    Serial.print(transitionCount);
    Serial.print(", high_samples=");
    Serial.print(highSampleCount);
    Serial.print(", low_samples=");
    Serial.print(lowSampleCount);
    Serial.print(", floating_samples=");
    Serial.print(floatingSampleCount);
    Serial.print(", driven_low_samples=");
    Serial.print(drivenLowSampleCount);
    Serial.print(", driven_high_samples=");
    Serial.print(drivenHighSampleCount);
    Serial.print(", current_high_ms=");
    Serial.println(highDurationMs);

    lastPrintAt = millis();
  }
}
