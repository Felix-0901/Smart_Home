import type { DeviceGroupMode } from "../features/devices/device-groups";
import { getPersistentItem, setPersistentItem } from "./persistent-storage";

const developerModeKey = "smart_home_developer_mode";
const deviceGroupModeKey = "smart_home_device_group_mode";
const homeRelayOrderKeyPrefix = "smart_home_home_relay_order";

export async function saveDeveloperMode(enabled: boolean) {
  await setPersistentItem(developerModeKey, enabled ? "true" : "false");
}

export async function getStoredDeveloperMode() {
  const value = await getPersistentItem(developerModeKey);
  return value === "true";
}

export async function saveDeviceGroupMode(mode: DeviceGroupMode) {
  await setPersistentItem(deviceGroupModeKey, mode);
}

export async function getStoredDeviceGroupMode(): Promise<DeviceGroupMode> {
  const value = await getPersistentItem(deviceGroupModeKey);
  return value === "space" ? "space" : "series";
}

export async function saveHomeRelayOrder(userId: string, deviceIds: string[]) {
  await setPersistentItem(`${homeRelayOrderKeyPrefix}_${userId}`, JSON.stringify(deviceIds));
}

export async function getStoredHomeRelayOrder(userId: string): Promise<string[]> {
  const value = await getPersistentItem(`${homeRelayOrderKeyPrefix}_${userId}`);

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
