export type InviteSeriesKey = "k_series" | "m_series" | "p_series" | "r_series" | "t_series";

type ReadingValue = string | number | boolean | null;
export type InviteReadingValues = Record<string, ReadingValue>;

export const inviteSeriesKeys: InviteSeriesKey[] = [
  "k_series",
  "m_series",
  "p_series",
  "r_series",
  "t_series"
];

const seriesCodeByKey: Record<InviteSeriesKey, string> = {
  k_series: "K",
  m_series: "M",
  p_series: "P",
  r_series: "R",
  t_series: "T"
};

export function seriesCodeForInvite(seriesKey: InviteSeriesKey) {
  return seriesCodeByKey[seriesKey];
}

export function isInviteSeriesKey(seriesKey: string): seriesKey is InviteSeriesKey {
  return inviteSeriesKeys.includes(seriesKey as InviteSeriesKey);
}

export function isInviteDemoCapabilities(capabilities: Record<string, unknown> | null | undefined) {
  return capabilities?.inviteDemo === true || capabilities?.virtualDevice === true;
}

export function buildInviteReadingValues(
  seriesKey: InviteSeriesKey,
  receivedAt: Date,
  options: {
    deviceOrdinal?: number;
    relayOn?: boolean;
    previousEnergyWh?: number;
  } = {}
): InviteReadingValues {
  const seed = makeSeed(`${seriesKey}:${options.deviceOrdinal ?? 0}:${Math.floor(receivedAt.getTime() / 600_000)}`);
  const temperature = round1(dailyWave(receivedAt, 25.6, 2.2, seed) + randomBetween(seed, -0.6, 0.6));
  const humidity = round1(dailyWave(receivedAt, 48, 8, seed + 19) + randomBetween(seed + 1, -2, 2));
  const heatIndex = round1(temperature + Math.max((humidity - 45) / 20, 0));
  const eco2 = Math.round(dailyWave(receivedAt, 520, 90, seed + 2) + randomBetween(seed + 3, -35, 35));
  const tvoc = Math.max(0, Math.round(dailyWave(receivedAt, 42, 28, seed + 4) + randomBetween(seed + 5, -12, 12)));
  const mqRaw = Math.max(120, Math.round(dailyWave(receivedAt, 620, 180, seed + 6) + randomBetween(seed + 7, -55, 55)));
  const mqVoltage = round3(adcToVoltage(mqRaw));
  const gasDetected = chance(seed + 8, 0.025);
  const flameDetected = chance(seed + 9, 0.003);
  const flameRaw = flameDetected
    ? Math.round(randomBetween(seed + 10, 900, 1900))
    : Math.round(randomBetween(seed + 11, 3650, 4095));
  const flameVoltage = round3(adcToVoltage(flameRaw));
  const wifiRssi = Math.round(randomBetween(seed + 12, -68, -43));
  const base = {
    dht_ok: true,
    temperature_c: temperature,
    humidity_percent: humidity,
    heat_index_c: heatIndex,
    sgp30_ok: true,
    eco2_ppm: Math.max(400, eco2),
    tvoc_ppb: tvoc,
    mq_raw: mqRaw,
    mq_voltage: mqVoltage,
    mq_analog_ok: true,
    mq_do: gasDetected ? 0 : 1,
    gas_detected: gasDetected,
    wifi_rssi: wifiRssi,
    network_ok: true,
    upload_ok: true,
    rgb_status: gasDetected ? "yellow_gas_warning" : "green_normal"
  };

  switch (seriesKey) {
    case "k_series":
      return {
        ...base,
        flame_raw: flameRaw,
        flame_voltage: flameVoltage,
        flame_do: flameDetected ? 0 : 1,
        flame_detected: flameDetected,
        rgb_status: flameDetected ? "red_flame_warning" : base.rgb_status
      };
    case "m_series": {
      const currentA = Math.max(0, round2(dailyWave(receivedAt, 0.32, 0.26, seed + 13) + randomBetween(seed + 14, -0.08, 0.08)));
      const currentSensorVoltage = round3(2.5 + currentA * 0.185);
      const currentAdcVoltage = round3(currentSensorVoltage / 1.5);
      return {
        ...base,
        flame_raw: flameRaw,
        flame_voltage: flameVoltage,
        flame_do: flameDetected ? 0 : 1,
        flame_detected: flameDetected,
        current_raw: Math.round((currentAdcVoltage / 3.3) * 4095),
        current_adc_voltage: currentAdcVoltage,
        current_sensor_voltage: currentSensorVoltage,
        charge_current_a: currentA,
        charge_current_ma: Math.round(currentA * 1000),
        oled_ok: true,
        rgb_status: flameDetected ? "red_flame_warning" : base.rgb_status
      };
    }
    case "p_series": {
      const relayOn = options.relayOn ?? !chance(seed + 15, 0.42);
      const voltage = round1(randomBetween(seed + 16, 108, 122));
      const current = relayOn ? round2(Math.max(0.08, dailyWave(receivedAt, 1.1, 0.7, seed + 17))) : 0;
      const power = round1(voltage * current);
      const previousEnergyWh = options.previousEnergyWh ?? randomBetween(seed + 18, 40, 160);
      const nextEnergyWh = round1(previousEnergyWh + power * 0.5);

      return {
        relay_on: relayOn,
        voltage_v: voltage,
        current_a: current,
        power_w: power,
        energy_wh: nextEnergyWh,
        current_raw: Math.round(randomBetween(seed + 19, 1820, 2210)),
        current_adc_voltage: round3(randomBetween(seed + 20, 1.46, 1.78)),
        current_sensor_voltage: round3(randomBetween(seed + 21, 2.2, 2.65)),
        mqtt_connected: true,
        availability: "online",
        wifi_rssi: wifiRssi
      };
    }
    case "r_series":
      return base;
    case "t_series": {
      const activeHour = receivedAt.getHours() >= 6 && receivedAt.getHours() <= 23;
      const motionDetected = activeHour ? chance(seed + 22, 0.36) : chance(seed + 23, 0.08);
      return {
        ...base,
        pir_level: motionDetected ? 1 : 0,
        motion_detected: motionDetected,
        motion_latched: motionDetected,
        presence_detected: motionDetected,
        rgb_status: motionDetected ? "blue_motion_detected" : base.rgb_status
      };
    }
  }
}

function adcToVoltage(raw: number) {
  return (raw / 4095) * 3.3;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function dailyWave(date: Date, center: number, amplitude: number, seed: number) {
  const dayMs = 86_400_000;
  const phase = seededRandom(seed) * Math.PI * 2;
  const radians = ((date.getTime() % dayMs) / dayMs) * Math.PI * 2 + phase;
  return center + Math.sin(radians) * amplitude;
}

function randomBetween(seed: number, min: number, max: number) {
  return min + seededRandom(seed) * (max - min);
}

function chance(seed: number, probability: number) {
  return seededRandom(seed) < probability;
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
}

function makeSeed(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}
