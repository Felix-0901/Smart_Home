import type { AuthTokens } from "../types/api";
import { deletePersistentItem, getPersistentItem, setPersistentItem } from "./persistent-storage";

const tokenStorageKey = "smart_home_app_tokens";

export async function saveTokens(tokens: AuthTokens) {
  await setPersistentItem(tokenStorageKey, JSON.stringify(tokens));
}

export async function getStoredTokens() {
  const value = await getPersistentItem(tokenStorageKey);
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
  await deletePersistentItem(tokenStorageKey);
}
