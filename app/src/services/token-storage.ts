import * as SecureStore from "expo-secure-store";
import type { AuthTokens } from "../types/api";

const tokenStorageKey = "smart_home_app_tokens";

export async function saveTokens(tokens: AuthTokens) {
  await SecureStore.setItemAsync(tokenStorageKey, JSON.stringify(tokens));
}

export async function getStoredTokens() {
  const value = await SecureStore.getItemAsync(tokenStorageKey);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthTokens;
  } catch {
    await clearTokens();
    return null;
  }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(tokenStorageKey);
}
