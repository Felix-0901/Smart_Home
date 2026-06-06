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

export type HomiRoute = "home" | "devices" | "data" | "profile" | "houses" | "account";

export type HomiRangeMode = "24h" | "7d" | "custom";

export type HomiDisplayMode = "chart" | "table" | "raw";

export type HomiCursorHint = {
  target: string;
  gesture: "move" | "tap" | "press" | "confirm";
};

type HomiActionBase = {
  id: string;
  description: string;
  cursorHints: HomiCursorHint[];
  requiresConfirmation: boolean;
};

export type HomiAction =
  | (HomiActionBase & {
      type: "say";
      message?: string;
    })
  | (HomiActionBase & {
      type: "ask_clarification";
      question: string;
      options?: Array<{ label: string; value: string }>;
    })
  | (HomiActionBase & {
      type: "navigate";
      route: HomiRoute;
    })
  | (HomiActionBase & {
      type: "set_data_query";
      deviceId: string;
      metric: string;
      rangeMode: HomiRangeMode;
      customFrom?: string;
      customTo?: string;
      displayMode: HomiDisplayMode;
      autoRun: boolean;
    })
  | (HomiActionBase & {
      type: "focus_home_relay";
      deviceId: string;
      expandRelayList: boolean;
    })
  | (HomiActionBase & {
      type: "focus_home_device";
      deviceId: string;
    })
  | (HomiActionBase & {
      type: "request_relay_confirmation";
      deviceId: string;
      deviceName: string;
      relayOn: boolean;
    })
  | (HomiActionBase & {
      type: "show_toast";
      message: string;
      tone: "info" | "success" | "warning" | "error";
    })
  | (HomiActionBase & {
      type: "set_preference";
      developerMode?: boolean;
      deviceGroupMode?: "series" | "space";
    })
  | (HomiActionBase & {
      type: "open_device_settings";
      deviceId: string;
    })
  | (HomiActionBase & {
      type: "set_device_profile";
      deviceId: string;
      alias?: string | null;
      houseId?: string | null;
      spaceId?: string | null;
    })
  | (HomiActionBase & {
      type: "claim_device";
      productCode: string;
    })
  | (HomiActionBase & {
      type: "open_house_detail";
      houseId: string;
    })
  | (HomiActionBase & {
      type: "create_house";
      name: string;
    })
  | (HomiActionBase & {
      type: "create_space";
      houseId: string;
      name: string;
    })
  | (HomiActionBase & {
      type: "rename_house";
      houseId: string;
      name: string;
    })
  | (HomiActionBase & {
      type: "rename_space";
      houseId: string;
      spaceId: string;
      name: string;
    });

export type HomiMessageResponse = {
  ok: true;
  assistantMessage: string;
  actions: HomiAction[];
  threadId: string;
  requiresUserConfirmation: boolean;
  debug?: Record<string, unknown>;
};

export type HomiHistoryMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
};

export type HomiHistoryResponse = {
  ok: true;
  threadId: string | null;
  month: string;
  messages: HomiHistoryMessage[];
};

export type InviteRedeemResponse = {
  ok: true;
  inviteCode: string;
  alreadyRedeemed: boolean;
  deviceCount: number;
  devices: Device[];
};
