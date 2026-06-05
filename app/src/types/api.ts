export type ReadingValue = string | number | boolean | null;

export type ReadingValues = Record<string, ReadingValue>;

export type Reading = {
  id: string;
  values: ReadingValues;
  metadata: Record<string, unknown>;
  received_at: string;
};

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type AuthResponse = {
  ok: true;
  user: AppUser;
  tokens: AuthTokens;
};

export type Device = {
  id: string;
  productCode: string;
  seriesKey: string;
  deviceId: string;
  displayName: string;
  modelName: string;
  capabilities: Record<string, unknown>;
  alias: string | null;
  roomName: string | null;
  houseId: string | null;
  houseName: string | null;
  spaceId: string | null;
  spaceName: string | null;
  claimedAt: string | null;
  latestReading?: Reading | null;
};

export type HouseSpace = {
  id: string;
  houseId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type House = {
  id: string;
  name: string;
  spaces: HouseSpace[];
  createdAt: string;
  updatedAt: string;
};
