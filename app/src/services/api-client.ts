import { API_BASE_URL } from "../config/env";
import type {
  AppUser,
  AuthResponse,
  Device,
  HomiHistoryResponse,
  HomiMessageResponse,
  House,
  HouseSpace,
  InviteRedeemResponse,
  Reading
} from "../types/api";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  accessToken?: string | null;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
  }
}

function buildUrl(path: string, query?: ApiRequestOptions["query"]) {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const headers: Record<string, string> = {
    accept: "application/json"
  };

  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `API request failed with ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "操作失敗，請稍後再試";
}

export function register(input: { email: string; password: string; displayName: string }) {
  return apiRequest<AuthResponse>("/api/app/auth/register", {
    method: "POST",
    body: input
  });
}

export function login(input: { email: string; password: string }) {
  return apiRequest<AuthResponse>("/api/app/auth/login", {
    method: "POST",
    body: input
  });
}

export function refresh(refreshToken: string) {
  return apiRequest<AuthResponse>("/api/app/auth/refresh", {
    method: "POST",
    body: { refreshToken }
  });
}

export function logout(refreshToken: string) {
  return apiRequest<void>("/api/app/auth/logout", {
    method: "POST",
    body: { refreshToken }
  });
}

export function getMe(accessToken: string) {
  return apiRequest<{ ok: true; user: AppUser }>("/api/app/me", { accessToken });
}

export function updateProfile(accessToken: string, input: { email: string; displayName: string }) {
  return apiRequest<{ ok: true; user: AppUser }>("/api/app/me", {
    method: "PATCH",
    accessToken,
    body: input
  });
}

export function changePassword(
  accessToken: string,
  input: { currentPassword: string; newPassword: string }
) {
  return apiRequest<{ ok: true; user: AppUser }>("/api/app/me/password", {
    method: "PATCH",
    accessToken,
    body: input
  });
}

export function deleteAccount(accessToken: string) {
  return apiRequest<void>("/api/app/me", {
    method: "DELETE",
    accessToken
  });
}

export function getDevices(accessToken: string) {
  return apiRequest<{ ok: true; devices: Device[] }>("/api/app/devices", { accessToken });
}

export function getHouses(accessToken: string) {
  return apiRequest<{ ok: true; houses: House[] }>("/api/app/houses", { accessToken });
}

export function getHouse(accessToken: string, houseId: string) {
  return apiRequest<{ ok: true; house: House }>(`/api/app/houses/${houseId}`, { accessToken });
}

export function createHouse(accessToken: string, name: string) {
  return apiRequest<{ ok: true; house: House }>("/api/app/houses", {
    method: "POST",
    accessToken,
    body: { name }
  });
}

export function updateHouse(accessToken: string, houseId: string, name: string) {
  return apiRequest<{ ok: true; house: House }>(`/api/app/houses/${houseId}`, {
    method: "PATCH",
    accessToken,
    body: { name }
  });
}

export function deleteHouse(accessToken: string, houseId: string) {
  return apiRequest<void>(`/api/app/houses/${houseId}`, {
    method: "DELETE",
    accessToken
  });
}

export function createHouseSpace(accessToken: string, houseId: string, name: string) {
  return apiRequest<{ ok: true; space: HouseSpace }>(`/api/app/houses/${houseId}/spaces`, {
    method: "POST",
    accessToken,
    body: { name }
  });
}

export function updateHouseSpace(
  accessToken: string,
  houseId: string,
  spaceId: string,
  name: string
) {
  return apiRequest<{ ok: true; space: HouseSpace }>(
    `/api/app/houses/${houseId}/spaces/${spaceId}`,
    {
      method: "PATCH",
      accessToken,
      body: { name }
    }
  );
}

export function deleteHouseSpace(accessToken: string, houseId: string, spaceId: string) {
  return apiRequest<void>(`/api/app/houses/${houseId}/spaces/${spaceId}`, {
    method: "DELETE",
    accessToken
  });
}

export function claimDevice(accessToken: string, productCode: string) {
  return apiRequest<{ ok: true; device: Device }>("/api/app/devices/claim", {
    method: "POST",
    accessToken,
    body: { productCode }
  });
}

export function redeemInviteCode(accessToken: string, inviteCode: string) {
  return apiRequest<InviteRedeemResponse>("/api/app/invites/redeem", {
    method: "POST",
    accessToken,
    body: { inviteCode }
  });
}

export function updateDevice(
  accessToken: string,
  deviceId: string,
  input: {
    alias?: string | null;
    roomName?: string | null;
    houseId?: string | null;
    spaceId?: string | null;
  }
) {
  return apiRequest<{ ok: true; device: Device }>(`/api/app/devices/${deviceId}`, {
    method: "PATCH",
    accessToken,
    body: input
  });
}

export function deleteDevice(accessToken: string, deviceId: string) {
  return apiRequest<void>(`/api/app/devices/${deviceId}`, {
    method: "DELETE",
    accessToken
  });
}

export function getDeviceLatest(accessToken: string, deviceId: string) {
  return apiRequest<{ ok: true; device: Device; reading: Reading | null }>(
    `/api/app/devices/${deviceId}/latest`,
    { accessToken }
  );
}

export function getDeviceReadings(
  accessToken: string,
  deviceId: string,
  query: { from?: string; to?: string; metric?: string; limit?: number }
) {
  return apiRequest<{ ok: true; device: Device; readings: Reading[] }>(
    `/api/app/devices/${deviceId}/readings`,
    { accessToken, query }
  );
}

export function setDeviceRelay(accessToken: string, deviceId: string, relayOn: boolean) {
  return apiRequest<{ ok: true }>(`/api/app/devices/${deviceId}/relay`, {
    method: "POST",
    accessToken,
    body: { relay_on: relayOn }
  });
}

export function sendHomiMessage(
  accessToken: string,
  input: {
    message: string;
    messages?: Array<{ role: "assistant" | "user"; text: string }>;
    clientState?: Record<string, unknown>;
    threadId?: string;
  }
) {
  return apiRequest<HomiMessageResponse>("/api/app/agent/messages", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function getHomiHistory(accessToken: string) {
  return apiRequest<HomiHistoryResponse>("/api/app/agent/history", {
    accessToken
  });
}

export function postHomiActionResult(
  accessToken: string,
  input: {
    threadId?: string;
    actionId: string;
    status: "succeeded" | "failed" | "canceled";
    result?: unknown;
    error?: string;
  }
) {
  return apiRequest<{ ok: true; matched: boolean }>("/api/app/agent/action-results", {
    method: "POST",
    accessToken,
    body: input
  });
}
