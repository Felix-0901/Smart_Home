import type { Device, Reading, ReadingValue } from "../../types/api";
import { colors } from "../../theme/colors";

export const seriesLabels: Record<string, string> = {
  k_series: "K 系列",
  m_series: "M 系列",
  p_series: "P 系列",
  r_series: "R 系列",
  t_series: "T 系列"
};

export const seriesShortLabels: Record<string, string> = {
  k_series: "K",
  m_series: "M",
  p_series: "P",
  r_series: "R",
  t_series: "T"
};

export const seriesColors: Record<string, string> = {
  k_series: colors.seriesK,
  m_series: colors.seriesM,
  p_series: colors.seriesP,
  r_series: colors.seriesR,
  t_series: colors.seriesT
};

export const metricLabels: Record<string, string> = {
  dht_ok: "溫濕度感測",
  temperature_c: "溫度",
  humidity_percent: "濕度",
  heat_index_c: "體感溫度",
  sgp30_ok: "空氣品質感測",
  eco2_ppm: "eCO2",
  tvoc_ppb: "TVOC",
  gas_raw: "氣體感測值",
  gas_voltage: "氣體感測電壓",
  gas_analog_ok: "氣體類比訊號",
  gas_do: "氣體警報腳位",
  gas_detected: "氣體警報",
  mq_raw: "氣體感測值",
  mq_voltage: "氣體感測電壓",
  mq_analog_ok: "氣體類比訊號",
  mq_do: "氣體警報腳位",
  mq_adc: "MQ 類比",
  flame_raw: "火焰感測值",
  flame_voltage: "火焰感測電壓",
  flame_do: "火焰警報腳位",
  flame_detected: "火焰",
  pir_level: "人體感測腳位",
  motion_detected: "人體活動",
  motion_latched: "人體活動保持",
  presence_detected: "人體",
  current_raw: "電流感測值",
  current_adc_voltage: "電流 ADC 電壓",
  current_sensor_voltage: "電流感測電壓",
  charge_current_a: "充電電流",
  charge_current_ma: "充電電流",
  voltage_v: "電壓",
  current_a: "電流",
  power_w: "功率",
  energy_wh: "累積用電",
  oled_ok: "OLED 顯示",
  relay_on: "插座",
  mqtt_connected: "連線",
  availability: "可用性",
  wifi_rssi: "Wi-Fi 訊號",
  network_ok: "網路連線",
  upload_ok: "資料上傳",
  rgb_status: "狀態燈"
};

export const metricUnits: Record<string, string> = {
  temperature_c: "°C",
  humidity_percent: "%",
  heat_index_c: "°C",
  eco2_ppm: "ppm",
  tvoc_ppb: "ppb",
  gas_raw: "ADC",
  mq_raw: "ADC",
  mq_adc: "ADC",
  flame_raw: "ADC",
  current_raw: "ADC",
  gas_voltage: "V",
  mq_voltage: "V",
  flame_voltage: "V",
  current_adc_voltage: "V",
  current_sensor_voltage: "V",
  charge_current_a: "A",
  charge_current_ma: "mA",
  voltage_v: "V",
  current_a: "A",
  power_w: "W",
  energy_wh: "Wh",
  wifi_rssi: "dBm"
};

const metricPriority = [
  "temperature_c",
  "humidity_percent",
  "heat_index_c",
  "eco2_ppm",
  "tvoc_ppb",
  "gas_detected",
  "flame_detected",
  "motion_detected",
  "relay_on",
  "power_w",
  "current_a",
  "voltage_v",
  "energy_wh",
  "charge_current_a",
  "wifi_rssi"
];

const hiddenMetricKeys = new Set([
  "dht_ok",
  "sgp30_ok",
  "gas_raw",
  "gas_voltage",
  "mq_analog_ok",
  "mq_raw",
  "mq_voltage",
  "gas_analog_ok",
  "gas_do",
  "mq_do",
  "flame_raw",
  "flame_voltage",
  "flame_do",
  "pir_level",
  "current_raw",
  "current_adc_voltage",
  "current_sensor_voltage",
  "network_ok",
  "upload_ok",
  "oled_ok",
  "relay_command_id",
  "raw_payload"
]);

export function getSeriesShortLabel(seriesKey: string) {
  return seriesShortLabels[seriesKey] ?? seriesKey.slice(0, 1).toUpperCase();
}

export function getSeriesColor(seriesKey: string) {
  return seriesColors[seriesKey] ?? colors.primary;
}

export function getDeviceTitle(device: Device) {
  return device.alias || device.displayName;
}

export function getDeviceSubtitle(device: Device) {
  const series = seriesLabels[device.seriesKey] ?? device.seriesKey;
  const locationParts = [device.houseName, device.roomName].filter(Boolean);
  const location = locationParts.length > 0 ? `${locationParts.join(" · ")} · ` : "";
  return `${location}${series} · ${device.productCode}`;
}

export function getMetricUnit(metricKey?: string) {
  return metricKey ? metricUnits[metricKey] : undefined;
}

export function formatReadingValue(value: ReadingValue, metricKey?: string) {
  if (typeof value === "boolean") {
    if (metricKey?.includes("detected") || metricKey === "presence_detected") {
      return value ? "偵測到" : "未偵測";
    }

    if (metricKey?.endsWith("_ok")) {
      return value ? "正常" : "異常";
    }

    if (metricKey === "mqtt_connected" || metricKey === "network_ok" || metricKey === "upload_ok") {
      return value ? "已連線" : "未連線";
    }

    return value ? "開啟" : "關閉";
  }

  if (typeof value === "number") {
    const decimals = metricKey?.includes("voltage") || metricKey === "current_a" || metricKey === "charge_current_a"
      ? 2
      : Number.isInteger(value)
        ? 0
        : 1;
    const formatted = decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);
    const unit = getMetricUnit(metricKey);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  if (typeof value === "string") {
    if (metricKey === "availability") {
      return value === "online" ? "在線" : value === "offline" ? "離線" : value;
    }

    if (metricKey === "rgb_status") {
      return formatRgbStatus(value);
    }

    return value;
  }

  return "無資料";
}

function formatRgbStatus(value: string) {
  const labels: Record<string, string> = {
    green_normal: "正常",
    yellow_gas_warning: "氣體警示",
    red_flame_warning: "火焰警示",
    blue_motion_detected: "偵測到人體活動",
    blue_wifi_connecting: "Wi-Fi 連線中",
    white_backend_error: "後端連線異常",
    purple_sensor_error: "感測器異常"
  };

  return labels[value] ?? value;
}

export function formatReadingTime(reading?: Reading | null) {
  if (!reading) {
    return "尚無資料";
  }

  const date = new Date(reading.received_at);
  if (Number.isNaN(date.getTime())) {
    return reading.received_at;
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getReadingMetricKeys(
  reading?: Reading | null,
  options: { includeHidden?: boolean; limit?: number } = {}
) {
  if (!reading) {
    return [];
  }

  const limit = options.limit ?? 10;

  return Object.keys(reading.values)
    .filter((key) => {
      if (key.endsWith("_command_id")) {
        return options.includeHidden === true;
      }

      return options.includeHidden === true || !hiddenMetricKeys.has(key);
    })
    .sort((a, b) => {
      const aIndex = metricPriority.indexOf(a);
      const bIndex = metricPriority.indexOf(b);
      if (aIndex === -1 && bIndex === -1) {
        return a.localeCompare(b);
      }

      if (aIndex === -1) {
        return 1;
      }

      if (bIndex === -1) {
        return -1;
      }

      return aIndex - bIndex;
    })
    .slice(0, limit);
}

export function getRelayState(reading?: Reading | null) {
  const relayValue = reading?.values.relay_on;
  return typeof relayValue === "boolean" ? relayValue : false;
}

export function getDeviceStatus(reading?: Reading | null) {
  if (!reading) {
    return { label: "離線", color: colors.offline };
  }

  const flameDetected = reading.values.flame_detected;
  if (flameDetected === true) {
    return { label: "告警", color: colors.danger };
  }

  return { label: "在線", color: colors.success };
}
