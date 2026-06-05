import type { Device } from "../../types/api";
import { getSeriesColor, seriesLabels } from "./device-format";

export type DeviceGroupMode = "series" | "space";

export type DeviceGroup = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  devices: Device[];
};

const seriesOrder = ["k_series", "m_series", "p_series", "r_series", "t_series"];

export function getDeviceGroups(devices: Device[], mode: DeviceGroupMode) {
  return mode === "space" ? groupBySpace(devices) : groupBySeries(devices);
}

function groupBySeries(devices: Device[]) {
  const groups = new Map<string, DeviceGroup>();

  for (const device of devices) {
    const title = seriesLabels[device.seriesKey] ?? device.seriesKey;
    const group = groups.get(device.seriesKey) ?? {
      id: device.seriesKey,
      title,
      subtitle: "依產品線檢視",
      color: getSeriesColor(device.seriesKey),
      devices: []
    };

    group.devices.push(device);
    groups.set(device.seriesKey, group);
  }

  return Array.from(groups.values()).sort((a, b) => {
    const aIndex = seriesOrder.indexOf(a.id);
    const bIndex = seriesOrder.indexOf(b.id);

    if (aIndex === -1 && bIndex === -1) {
      return a.title.localeCompare(b.title);
    }

    if (aIndex === -1) {
      return 1;
    }

    if (bIndex === -1) {
      return -1;
    }

    return aIndex - bIndex;
  });
}

function groupBySpace(devices: Device[]) {
  const groups = new Map<string, DeviceGroup>();

  for (const device of devices) {
    const groupId = device.spaceId ?? device.houseId ?? "unassigned";
    const houseLabel = device.houseName ?? null;
    const spaceLabel = device.roomName ?? null;
    const title = houseLabel && spaceLabel
      ? `${houseLabel} · ${spaceLabel}`
      : houseLabel
        ? `${houseLabel} · 未指定空間`
        : "未指定空間";
    const subtitle = houseLabel ? "依房屋空間檢視" : "尚未設定房屋與空間";
    const group = groups.get(groupId) ?? {
      id: groupId,
      title,
      subtitle,
      color: getSeriesColor(device.seriesKey),
      devices: []
    };

    group.devices.push(device);
    groups.set(groupId, group);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.id === "unassigned") {
      return 1;
    }

    if (b.id === "unassigned") {
      return -1;
    }

    return a.title.localeCompare(b.title);
  });
}
