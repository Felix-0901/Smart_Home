import * as SecureStore from "expo-secure-store";
import type { DeviceGroupMode } from "../features/devices/device-groups";

const developerModeKey = "smart_home_developer_mode";
const deviceGroupModeKey = "smart_home_device_group_mode";
const homeRelayOrderKeyPrefix = "smart_home_home_relay_order";

export async function saveDeveloperMode(enabled: boolean) {
  await SecureStore.setItemAsync(developerModeKey, enabled ? "true" : "false");
}

export async function getStoredDeveloperMode() {
  const value = await SecureStore.getItemAsync(developerModeKey);
  return value === "true";
}

export async function saveDeviceGroupMode(mode: DeviceGroupMode) {
  await SecureStore.setItemAsync(deviceGroupModeKey, mode);
}

export async function getStoredDeviceGroupMode(): Promise<DeviceGroupMode> {
  const value = await SecureStore.getItemAsync(deviceGroupModeKey);
  return value === "space" ? "space" : "series";
}

export async function saveHomeRelayOrder(userId: string, deviceIds: string[]) {
  await SecureStore.setItemAsync(`${homeRelayOrderKeyPrefix}_${userId}`, JSON.stringify(deviceIds));
}

export async function getStoredHomeRelayOrder(userId: string): Promise<string[]> {
  const value = await SecureStore.getItemAsync(`${homeRelayOrderKeyPrefix}_${userId}`);

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
