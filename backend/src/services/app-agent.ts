import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { createBaseSchema } from "../db/schema.js";
import type { AppUser } from "./app-auth.js";
import { listUserDevices } from "./app-devices.js";
import { listUserHouses } from "./app-houses.js";
import { getDeviceReadings } from "./readings.js";

type UserDevice = Awaited<ReturnType<typeof listUserDevices>>[number];

type AgentChatHistoryMessage = {
  role: "assistant" | "user";
  text: string;
};

type AgentClientState = Record<string, unknown> & {
  currentRoute?: string;
  selectedDeviceId?: string;
  selectedMetric?: string;
  rangeMode?: string;
  displayMode?: string;
};

type HomiActionBase = {
  id: string;
  type:
    | "say"
    | "ask_clarification"
    | "navigate"
    | "set_data_query"
    | "focus_home_relay"
    | "focus_home_device"
    | "request_relay_confirmation"
    | "show_toast"
    | "set_preference"
    | "open_device_settings"
    | "set_device_profile"
    | "claim_device"
    | "open_house_detail"
    | "create_house"
    | "create_space"
    | "rename_house"
    | "rename_space";
  description: string;
  cursorHints: CursorHint[];
  requiresConfirmation: boolean;
};

type CursorHint = {
  target: string;
  gesture: "move" | "tap" | "press" | "confirm";
};

export type HomiAction =
  | (HomiActionBase & { type: "say"; message?: string })
  | (HomiActionBase & {
      type: "ask_clarification";
      question: string;
      options?: Array<{ label: string; value: string }>;
    })
  | (HomiActionBase & { type: "navigate"; route: AgentRoute })
  | (HomiActionBase & {
      type: "set_data_query";
      deviceId: string;
      metric: string;
      rangeMode: DataRangeMode;
      customFrom?: string;
      customTo?: string;
      displayMode: DataDisplayMode;
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

type HomiActionInput = HomiAction extends infer TAction
  ? TAction extends HomiAction
    ? Omit<TAction, "id"> & { id?: string }
    : never
  : never;

export type AgentMessageInput = {
  message: string;
  messages?: AgentChatHistoryMessage[];
  clientState?: AgentClientState;
  threadId?: string;
};

export type AgentActionResultInput = {
  threadId?: string;
  actionId: string;
  status: "succeeded" | "failed" | "canceled";
  result?: unknown;
  error?: string;
};

type AgentRoute = "home" | "devices" | "data" | "profile" | "houses" | "account";
type DataRangeMode = "24h" | "7d" | "custom";
type DataDisplayMode = "chart" | "table" | "raw";
type HomiIntentCategory =
  | "information_only"
  | "app_navigation"
  | "app_tutorial"
  | "data_operation"
  | "device_control"
  | "device_management"
  | "profile_management"
  | "preference_update"
  | "clarification"
  | "mixed";

type HomiIntent = {
  category: HomiIntentCategory;
  needsAppAction: boolean;
  confidence?: number;
  reason?: string;
};

type AgentPlan = {
  assistantMessage: string;
  actions: HomiAction[];
  intent?: HomiIntent;
  model?: string;
  source: "ai" | "fallback" | "rules";
  warnings: string[];
};

type RawAgentPlan = {
  intent?: unknown;
  assistantMessage?: unknown;
  actions?: unknown;
};

type HomiDeviceContext = {
  id: string;
  productCode: string;
  series: string;
  deviceId: string;
  displayName: string;
  nickname: string;
  modelName: string;
  house: string | null;
  space: string | null;
  capabilities: Record<string, unknown>;
  online: boolean;
  latestMetrics: Record<string, unknown>;
};

type HomiContext = {
  user: {
    id: string;
    displayName: string;
  };
  houses: Awaited<ReturnType<typeof listUserHouses>>;
  devices: HomiDeviceContext[];
  rawDevices: UserDevice[];
  metrics: string[];
};

type ThreadMemory = {
  summary: string | null;
  recentMessages: AgentChatHistoryMessage[];
};

export type AgentHistoryMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
};

type DeviceResolution = {
  candidates: HomiDeviceContext[];
  reason:
    | "none"
    | "explicit_device"
    | "actual_location"
    | "series"
    | "metric_capability"
    | "ambiguous_location_alias"
    | "whole_home";
  unresolvedTerms: string[];
};

const allowedRoutes = new Set<AgentRoute>(["home", "devices", "data", "profile", "houses", "account"]);
const allowedRangeModes = new Set<DataRangeMode>(["24h", "7d", "custom"]);
const allowedDisplayModes = new Set<DataDisplayMode>(["chart", "table", "raw"]);
const allowedDeviceGroupModes = new Set(["series", "space"]);
const allowedIntentCategories = new Set<HomiIntentCategory>([
  "information_only",
  "app_navigation",
  "app_tutorial",
  "data_operation",
  "device_control",
  "device_management",
  "profile_management",
  "preference_update",
  "clarification",
  "mixed"
]);
const publicMetricKeys = new Set([
  "temperature_c",
  "humidity_percent",
  "heat_index_c",
  "eco2_ppm",
  "tvoc_ppb",
  "gas_detected",
  "flame_detected",
  "motion_detected",
  "motion_latched",
  "presence_detected",
  "relay_on",
  "power_w",
  "current_a",
  "voltage_v",
  "energy_wh",
  "charge_current_a",
  "charge_current_ma",
  "wifi_rssi",
  "mqtt_connected",
  "availability",
  "rgb_status"
]);
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
const metricAliases: Array<{ metric: string; keywords: string[] }> = [
  { metric: "temperature_c", keywords: ["溫度", "temperature", "temp"] },
  { metric: "humidity_percent", keywords: ["濕度", "humidity"] },
  { metric: "heat_index_c", keywords: ["體感", "熱指數"] },
  { metric: "eco2_ppm", keywords: ["eco2", "e co2", "co2", "二氧化碳", "空氣"] },
  { metric: "tvoc_ppb", keywords: ["tvoc", "揮發", "空氣品質"] },
  { metric: "gas_detected", keywords: ["瓦斯", "氣體", "gas"] },
  { metric: "flame_detected", keywords: ["火焰", "火警", "失火", "flame"] },
  { metric: "motion_detected", keywords: ["人體活動", "活動", "motion"] },
  { metric: "presence_detected", keywords: ["有人", "人體", "presence", "廁所"] },
  { metric: "relay_on", keywords: ["插座狀態", "開關狀態", "relay"] },
  { metric: "power_w", keywords: ["功率", "耗電", "power"] },
  { metric: "current_a", keywords: ["電流", "current"] },
  { metric: "voltage_v", keywords: ["電壓", "voltage"] },
  { metric: "energy_wh", keywords: ["用電", "累積用電", "energy"] },
  { metric: "wifi_rssi", keywords: ["wifi", "wi-fi", "訊號"] }
];
const seriesAliases: Record<string, string[]> = {
  k_series: ["k", "廚房", "k系列", "k 系列"],
  m_series: ["m", "main", "主機", "m系列", "m 系列"],
  p_series: ["p", "插座", "智慧插座", "p系列", "p 系列"],
  r_series: ["r", "房間", "r系列", "r 系列"],
  t_series: ["t", "廁所", "浴室", "t系列", "t 系列"]
};
const locationLikeTerms = ["廚房", "客廳", "房間", "臥室", "廁所", "浴室", "陽台", "玄關", "書房"];
const seriesDefaultMetrics: Record<string, string[]> = {
  k_series: [
    "temperature_c",
    "humidity_percent",
    "heat_index_c",
    "eco2_ppm",
    "tvoc_ppb",
    "gas_detected",
    "flame_detected"
  ],
  m_series: [
    "temperature_c",
    "humidity_percent",
    "heat_index_c",
    "eco2_ppm",
    "tvoc_ppb",
    "gas_detected"
  ],
  p_series: ["relay_on", "power_w", "current_a", "voltage_v", "energy_wh"],
  r_series: ["temperature_c", "humidity_percent", "heat_index_c"],
  t_series: ["presence_detected", "motion_detected", "motion_latched"]
};

async function ensureAgentSchema() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function handleAgentMessage(user: AppUser, input: AgentMessageInput) {
  await ensureAgentSchema();
  await pruneAgentHistoryBeforeCurrentMonth(user.id);

  const threadId = await getOrCreateThread(user.id, input.threadId, input.message);
  const context = await buildHomiContext(user);
  const warnings: string[] = [];

  await storeAgentMessage({
    threadId,
    userId: user.id,
    role: "user",
    content: input.message,
    actions: [],
    clientState: input.clientState ?? {},
    model: null
  });

  const memory = await buildThreadMemory(threadId, user.id);
  let plan: AgentPlan | null = null;

  if (isAiConfigured()) {
    try {
      plan = await createAiPlan(context, input, memory);
    } catch (error) {
      warnings.push(`AI plan failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (!plan) {
    plan = await createRulePlan(context, input, memory);
  }

  if (!plan) {
    plan = await createFallbackPlan(context, input);
    plan.warnings.push(...warnings);
  }

  await storeAgentMessage({
    threadId,
    userId: user.id,
    role: "assistant",
    content: plan.assistantMessage,
    actions: plan.actions,
    clientState: {},
    model: plan.model ?? null
  });
  await storeActionRuns(threadId, user.id, plan.actions);
  await maybeCompactThread(threadId, user.id);

  return {
    assistantMessage: plan.assistantMessage,
    actions: plan.actions,
    threadId,
    requiresUserConfirmation: plan.actions.some((action) => action.requiresConfirmation),
    ...(process.env.NODE_ENV !== "production"
      ? {
          debug: {
            source: plan.source,
            model: plan.model ?? null,
            intent: plan.intent ?? null,
            warnings: plan.warnings
          }
        }
      : {})
  };
}

export async function getAgentMonthlyHistory(user: AppUser) {
  await ensureAgentSchema();
  await pruneAgentHistoryBeforeCurrentMonth(user.id);

  const bounds = currentMonthBounds();
  const threadResult = await pool.query<{ id: string }>(
    `
      SELECT id::text
      FROM app_agent_threads
      WHERE user_id = $1
        AND created_at >= $2::timestamptz
        AND created_at < $3::timestamptz
      ORDER BY updated_at DESC
      LIMIT 1;
    `,
    [user.id, bounds.from, bounds.to]
  );
  const threadId = threadResult.rows[0]?.id ?? null;

  if (!threadId) {
    return {
      threadId: null,
      month: bounds.month,
      messages: [] as AgentHistoryMessage[]
    };
  }

  const messagesResult = await pool.query<{
    id: string;
    role: "assistant" | "user";
    content: string;
    created_at: string;
  }>(
    `
      SELECT id::text, role, content, created_at::text
      FROM app_agent_messages
      WHERE user_id = $1
        AND role IN ('user', 'assistant')
        AND created_at >= $2::timestamptz
        AND created_at < $3::timestamptz
      ORDER BY created_at ASC;
    `,
    [user.id, bounds.from, bounds.to]
  );

  return {
    threadId,
    month: bounds.month,
    messages: messagesResult.rows.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at
    }))
  };
}

export async function recordAgentActionResult(userId: string, input: AgentActionResultInput) {
  await ensureAgentSchema();

  const result = await pool.query(
    `
      UPDATE app_agent_action_runs
      SET status = $3,
          result = COALESCE($4::jsonb, result),
          error = $5,
          updated_at = now()
      WHERE user_id = $1
        AND action_id = $2
        AND ($6::uuid IS NULL OR thread_id = $6::uuid);
    `,
    [
      userId,
      input.actionId,
      input.status,
      input.result === undefined ? null : JSON.stringify(input.result),
      input.error ?? null,
      input.threadId ?? null
    ]
  );

  return {
    matched: (result.rowCount ?? 0) > 0
  };
}

async function buildHomiContext(user: AppUser): Promise<HomiContext> {
  const [rawDevices, houses] = await Promise.all([
    listUserDevices(user.id),
    listUserHouses(user.id)
  ]);
  const metricSet = new Set<string>();
  const devices = rawDevices.map((device) => {
    const latestMetrics = pickClientVisibleMetrics(device.latestReading?.values ?? {});

    for (const key of Object.keys(latestMetrics)) {
      metricSet.add(key);
    }

    return {
      id: device.id,
      productCode: device.productCode,
      series: device.seriesKey,
      deviceId: device.deviceId,
      displayName: device.displayName,
      nickname: device.alias || device.displayName,
      modelName: device.modelName,
      house: device.houseName,
      space: device.spaceName ?? device.roomName,
      capabilities: device.capabilities,
      online: Boolean(device.latestReading),
      latestMetrics
    };
  });

  for (const metric of publicMetricKeys) {
    metricSet.add(metric);
  }

  return {
    user: {
      id: user.id,
      displayName: user.displayName
    },
    houses,
    devices,
    rawDevices,
    metrics: Array.from(metricSet).sort()
  };
}

function pickClientVisibleMetrics(values: Record<string, unknown>) {
  const metrics: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (key.endsWith("_command_id") || hiddenMetricKeys.has(key)) {
      continue;
    }

    metrics[key] = value;
  }

  return metrics;
}

async function createAiPlan(
  context: HomiContext,
  input: AgentMessageInput,
  memory: ThreadMemory
): Promise<AgentPlan> {
  const prompt = buildAgentPrompt(context, input, memory);
  const models = [config.AI_MODEL, config.AI_FALLBACK_MODEL].filter(
    (model): model is string => Boolean(model)
  );
  const warnings: string[] = [];

  for (const model of models) {
    try {
      const rawPlan = await callChatCompletions(model, prompt);
      const normalizedPlan = normalizeRawPlan(rawPlan, context, input, "ai", model);
      return {
        ...normalizedPlan,
        warnings: [...warnings, ...normalizedPlan.warnings]
      };
    } catch (error) {
      warnings.push(`${model}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  throw new Error(warnings.join("; ") || "AI plan could not be created");
}

function buildAgentPrompt(context: HomiContext, input: AgentMessageInput, memory: ThreadMemory) {
  const devices = context.devices.map((device) => ({
    id: device.id,
    nickname: device.nickname,
    productCode: device.productCode,
    series: device.series,
    house: device.house,
    space: device.space,
    capabilities: device.capabilities,
    online: device.online,
    latestMetrics: device.latestMetrics
  }));

  return {
    system: [
      "You are Homi, a smart home app agent for a React Native app.",
      "You are not a generic chatbot. You plan app actions like an agent runtime with a fixed tool list.",
      "Before producing actions, classify the user's intent yourself and include it in the JSON as intent.",
      "Intent categories: information_only, app_navigation, app_tutorial, data_operation, device_control, device_management, profile_management, preference_update, clarification, mixed.",
      "intent.needsAppAction is your own decision. Set it to false when the user only wants an answer in chat. Set it to true only when the user explicitly asks Homi to operate, navigate, teach by showing UI, configure, query a chart/table/raw view, or control a device.",
      "Information-only examples that must not navigate or operate: '家裡目前狀況還好嗎？', '客廳目前環境如何？', '客廳有哪些裝置？', '今天家裡狀態如何？'. For these, answer in text and optionally ask a follow-up question, but do not include navigate, set_data_query, focus_home_relay, request_relay_confirmation, or show_toast.",
      "Operation examples that may produce actions: '帶我到數據頁', '教我新增產品', '幫我看客廳智慧插座 7 天功率圖表', '帶我看客廳智慧插座即時狀態', '打開客廳智慧插座', '把裝置顯示改成空間模式'.",
      "If a request can be answered from provided context and the user did not clearly ask for app operation, prefer information_only with no app actions.",
      "The backend validates every action. Never invent device IDs, metrics, routes, or action types.",
      "Relay control must only target a unique owned P series device. The app executes the validated relay action after a visual switch tap.",
      "For relay control, generic phrases such as '打開', '關閉', '打開插座', or '關閉 P 系列' are ambiguous. Ask which plug unless the message contains a product code, exact nickname, or actual house/space that resolves to exactly one P series device.",
      "If the user did not specify a unique target device, ask for clarification instead of guessing. Never choose the first device.",
      "If an ask_clarification action is needed, do not include navigate or set_data_query before it.",
      "Do not treat product-line names such as K series/kitchen series as the user's actual room. Actual rooms must come from house/space fields.",
      "If the user says a room name that is not in actualLocations, ask which device they mean.",
      "For home status overview requests, summarize latest status in chat only unless the user explicitly asks to navigate or operate the app.",
      "For broad room/space questions such as '客廳目前環境如何', answer with a text summary of all devices in that actual space. Do not open the data chart unless the user explicitly asks to see a chart/table/raw view and names a specific device nickname or product code.",
      "APP map: home shows live summary and P series relay switches; devices manages claimed products; data shows charts/tables/raw readings with device, metric, and time filters; profile contains houses, spaces, account, developer mode; assistant is the Homi chat surface.",
      "Agent design: think like OpenClaw/OpenCode style tool use. Return actions only from the allowlist. The app will execute them; you do not operate pixels directly.",
      "Output only a JSON object with intent, assistantMessage, and actions.",
      "Allowed routes: home, devices, data, profile, houses, account.",
      "Allowed rangeMode: 24h, 7d, custom. Allowed displayMode: chart, table, raw.",
      "Supported action types: say, ask_clarification, navigate, set_data_query, focus_home_relay, focus_home_device, request_relay_confirmation, show_toast, set_preference, open_device_settings, set_device_profile, claim_device, open_house_detail, create_house, create_space, rename_house, rename_space.",
      "Each action must include id, type, description, cursorHints, requiresConfirmation.",
      "cursorHints target examples: tab.home, tab.data, data.devicePicker, data.metricPicker, data.timeRange, data.displayMode, data.queryButton, home.relay.<deviceId>, home.device.<deviceId>, devices.device.<deviceId>, profile.deviceGroupMode, profile.developerMode, houses.house.<houseId>.",
      "For data chart/table/raw operations, use navigate to data then set_data_query with autoRun true only when the user's message explicitly contains one owned device nickname, productCode, or deviceId. Do not use room, space, house, series, or metric-only matches to choose a chart device.",
      "For realtime device-card viewing, use navigate home then focus_home_device only when the user's message explicitly contains one owned device nickname, productCode, or deviceId. Broad room or whole-home status should stay information_only unless the user asks to be taken to the UI.",
      "If the user asks how to use the app, teach by navigating and pointing at the relevant page. Do not modify profile, email, password, or delete anything. Low-risk preference toggles may be changed only when the user clearly asks to turn them on/off.",
      "For relay requests, prefer focus_home_relay then request_relay_confirmation only if a unique P series device is explicitly resolved. Do not ask for a second confirmation if the device is unique.",
      "For device settings, only use set_device_profile after resolving one owned device and existing house/space IDs. If the user names a house/space that does not exist, ask clarification or create it only when the user explicitly asks to create it.",
      "For account, password, email, logout, delete, and destructive operations: do not perform direct actions. Navigate to the relevant page and explain what the user must do.",
      "Schema example: {\"intent\":{\"category\":\"data_operation\",\"needsAppAction\":true,\"confidence\":0.91,\"reason\":\"User explicitly asked to open a chart for one device\"},\"assistantMessage\":\"...\",\"actions\":[{\"id\":\"a1\",\"type\":\"navigate\",\"route\":\"data\",\"description\":\"...\",\"cursorHints\":[{\"target\":\"tab.data\",\"gesture\":\"tap\"}],\"requiresConfirmation\":false}]}",
      "Information-only schema example: {\"intent\":{\"category\":\"information_only\",\"needsAppAction\":false,\"confidence\":0.94,\"reason\":\"User asked for current home status only\"},\"assistantMessage\":\"家裡目前整體正常...\\n\\n你有想查看特定裝置的長期或即時數據嗎？\",\"actions\":[{\"id\":\"a1\",\"type\":\"say\",\"message\":\"家裡目前整體正常...\",\"description\":\"只回覆目前狀態\",\"cursorHints\":[],\"requiresConfirmation\":false}]}"
    ].join("\n"),
    user: JSON.stringify({
      user: context.user,
      devices,
      houses: context.houses,
      availableMetrics: context.metrics,
      appCapabilities: buildAppCapabilityMap(context),
      actualLocations: getActualLocationNames(context),
      conversationSummary: memory.summary,
      currentAppState: input.clientState ?? {},
      recentMessages: memory.recentMessages.length > 0 ? memory.recentMessages : (input.messages ?? []).slice(-10),
      message: input.message
    })
  };
}

function buildAppCapabilityMap(context: HomiContext) {
  return {
    principles: [
      "All app operations must use whitelisted actions.",
      "Use IDs from devices/houses/spaces only; never invent IDs.",
      "Ask clarification when multiple devices, spaces, or houses match.",
      "Do not use product-line names as actual rooms unless the user has a house/space with that name.",
      "Destructive or credential operations are navigation-only."
    ],
    pages: [
      {
        route: "home",
        purpose: "即時總覽、P 系列智慧插座控制、依系列或空間顯示裝置卡片",
        targets: [
          "tab.home",
          "home.relay.<deviceId>",
          "home.device.<deviceId>"
        ],
        actions: [
          "navigate",
          "focus_home_device",
          "focus_home_relay",
          "request_relay_confirmation"
        ]
      },
      {
        route: "devices",
        purpose: "用產品編號綁定裝置、開啟裝置設定、調整暱稱/房屋/空間",
        targets: [
          "tab.devices",
          "devices.claimInput",
          "devices.claimButton",
          "devices.device.<deviceId>",
          "devices.sheet.alias",
          "devices.sheet.house",
          "devices.sheet.space",
          "devices.sheet.save"
        ],
        actions: [
          "navigate",
          "claim_device",
          "open_device_settings",
          "set_device_profile"
        ]
      },
      {
        route: "data",
        purpose: "依裝置、感測欄位、時間範圍與顯示模式查詢歷史數據",
        targets: [
          "tab.data",
          "data.devicePicker",
          "data.metricPicker",
          "data.timeRange",
          "data.displayMode",
          "data.queryButton"
        ],
        actions: [
          "navigate",
          "set_data_query"
        ]
      },
      {
        route: "profile",
        purpose: "帳號入口、房屋入口、裝置顯示模式、開發者模式",
        targets: [
          "tab.profile",
          "profile.account",
          "profile.houses",
          "profile.deviceGroupMode",
          "profile.developerMode"
        ],
        actions: [
          "navigate",
          "set_preference"
        ]
      },
      {
        route: "houses",
        purpose: "新增/重新命名房屋、進入房屋詳情、新增/重新命名空間",
        targets: [
          "profile.houses",
          "houses.create",
          "houses.house.<houseId>",
          "houses.space.create",
          "houses.space.<spaceId>"
        ],
        actions: [
          "navigate",
          "open_house_detail",
          "create_house",
          "create_space",
          "rename_house",
          "rename_space"
        ]
      },
      {
        route: "account",
        purpose: "使用者自行修改 email、顯示名稱、密碼或註銷帳號",
        targets: [
          "profile.account"
        ],
        actions: [
          "navigate",
          "show_toast"
        ],
        blockedActions: [
          "change_password",
          "delete_account",
          "logout",
          "edit_email"
        ]
      }
    ],
    devices: context.devices.map((device) => ({
      id: device.id,
      nickname: device.nickname,
      productCode: device.productCode,
      series: device.series,
      location: {
        house: device.house,
        space: device.space
      },
      allowedOperations: [
        "focus_home_device",
        "open_device_settings",
        "set_device_profile",
        ...(device.series === "p_series" ? ["focus_home_relay", "request_relay_confirmation"] : [])
      ],
      metrics: getDeviceMetricOptions(device)
    })),
    houses: context.houses.map((house) => ({
      id: house.id,
      name: house.name,
      spaces: house.spaces.map((space) => ({ id: space.id, name: space.name }))
    })),
    safety: {
      relay: "Must resolve exactly one owned P series device. Direct execution is allowed after model policy and backend validation; no second confirmation sheet.",
      data: "No missing samples are converted to 0; summaries use only existing samples.",
      blocked: [
        "delete device",
        "delete house",
        "delete space",
        "delete account",
        "change password",
        "logout"
      ]
    }
  };
}

async function callChatCompletions(model: string, prompt: { system: string; user: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(chatCompletionsUrl(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.AI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI HTTP ${response.status}: ${text.slice(0, 180)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI response missing message content");
    }

    return parseJsonContent(content) as RawAgentPlan;
  } finally {
    clearTimeout(timeout);
  }
}

function chatCompletionsUrl() {
  const baseUrl = config.AI_BASE_URL.replace(/\/+$/, "");
  return baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;
}

function isAiConfigured() {
  return Boolean(
    config.AI_ENABLED &&
      config.AI_API_KEY &&
      !config.AI_API_KEY.includes("<") &&
      !config.AI_API_KEY.toLowerCase().includes("placeholder")
  );
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fencedMatch?.[1] ?? trimmed);
}

async function createFallbackPlan(
  context: HomiContext,
  input: AgentMessageInput
): Promise<AgentPlan> {
  return createStatusPlan(context, "fallback");
}

async function createRulePlan(
  context: HomiContext,
  input: AgentMessageInput,
  _memory: ThreadMemory
): Promise<AgentPlan | null> {
  const normalizedMessage = normalizeText(input.message);

  const productClaimPlan = createProductClaimPlan(context, normalizedMessage, "rules");
  if (productClaimPlan) {
    return productClaimPlan;
  }

  if (isLocationStatusIntent(normalizedMessage)) {
    const locationStatusPlan = createLocationStatusPlan(context, normalizedMessage, "rules");
    if (locationStatusPlan) {
      return locationStatusPlan;
    }
  }

  const teachingPlan = createTeachingPlan(normalizedMessage, "rules");
  if (teachingPlan) {
    return teachingPlan;
  }

  if (isStatusOverviewIntent(normalizedMessage)) {
    return createStatusPlan(context, "rules");
  }

  if (isRelayIntent(normalizedMessage)) {
    return createFallbackRelayPlan(context, normalizedMessage, "rules");
  }

  if (isNavigationIntent(normalizedMessage) && !isDataIntent(normalizedMessage)) {
    return createFallbackNavigationPlan(normalizedMessage, "rules");
  }

  if (isDataIntent(normalizedMessage)) {
    return createFallbackDataPlan(context, normalizedMessage, "rules");
  }

  return null;
}

function createStatusPlan(context: HomiContext, source: AgentPlan["source"]): AgentPlan {
  return {
    assistantMessage: buildLatestStatusText(context),
    actions: [],
    intent: {
      category: "information_only",
      needsAppAction: false,
      reason: "Status overview can be answered in chat"
    },
    source,
    warnings: []
  };
}

function createProductClaimPlan(
  context: HomiContext,
  message: string,
  source: AgentPlan["source"]
): AgentPlan | null {
  if (!mentionsProductClaimIntent(message)) {
    return null;
  }

  const productCode = inferProductCode(message);
  if (!productCode) {
    return null;
  }

  const alreadyClaimed = context.devices.some((device) => normalizeText(device.productCode) === normalizeText(productCode));
  if (alreadyClaimed) {
    return {
      assistantMessage: `「${productCode}」已經在你的裝置清單中。我帶你到裝置頁查看它。`,
      actions: [
        createAction({
          type: "navigate",
          route: "devices",
          description: "切換到裝置頁查看已綁定產品",
          cursorHints: [{ target: "tab.devices", gesture: "tap" }],
          requiresConfirmation: false
        })
      ],
      source,
      warnings: []
    };
  }

  return {
    assistantMessage: `我會帶你到裝置頁，並用產品編號「${productCode}」綁定裝置。`,
    actions: [
      createAction({
        type: "claim_device",
        productCode,
        description: `綁定產品 ${productCode}`,
        cursorHints: [
          { target: "tab.devices", gesture: "tap" },
          { target: "devices.claimInput", gesture: "tap" },
          { target: "devices.claimButton", gesture: "confirm" }
        ],
        requiresConfirmation: false
      })
    ],
    source,
    warnings: []
  };
}

function createTeachingPlan(message: string, source: AgentPlan["source"]): AgentPlan | null {
  const tutorial = inferTutorialTopic(message);
  if (!tutorial) {
    return null;
  }

  return {
    assistantMessage: tutorial.message,
    actions: tutorial.actions.map((action) => createAction(action)),
    source,
    warnings: []
  };
}

function createLocationStatusPlan(
  context: HomiContext,
  message: string,
  source: AgentPlan["source"]
): AgentPlan | null {
  const location = resolveActualLocation(context, message);
  if (!location) {
    return null;
  }

  const devices = context.devices.filter((device) => {
    const house = device.house ? normalizeText(device.house) : null;
    const space = device.space ? normalizeText(device.space) : null;
    return house === location.normalized || space === location.normalized;
  });

  if (devices.length === 0) {
    return {
      assistantMessage: `「${location.name}」目前沒有綁定任何裝置。你可以到裝置設定裡把裝置指定到這個空間。\n\n你有想要查看特定裝置的長期或即時數據嗎？`,
      actions: [],
      source,
      warnings: []
    };
  }

  return {
    assistantMessage: buildLocationStatusText(location.name, devices),
    actions: [],
    source,
    warnings: []
  };
}

function inferTutorialTopic(message: string): { message: string; actions: HomiActionInput[] } | null {
  if (!mentionsTutorialIntent(message)) {
    return null;
  }

  if (mentionsProductClaimTopic(message)) {
    return {
      message: [
        "新增產品要從「裝置」頁完成。",
        "",
        "1. 進入裝置頁。",
        "2. 在產品編號欄位輸入裝置外殼或資料表上的產品編號。",
        "3. 點擊「綁定裝置」。",
        "",
        "如果你直接告訴我產品編號，例如 `P-DEMO-0001`，我也可以幫你送出綁定操作。"
      ].join("\n"),
      actions: [
        {
          type: "navigate",
          route: "devices",
          description: "帶使用者到裝置頁學習新增產品",
          cursorHints: [{ target: "tab.devices", gesture: "tap" }],
          requiresConfirmation: false
        },
        {
          type: "show_toast",
          message: "在這裡輸入產品編號並綁定裝置",
          tone: "info",
          description: "提示產品編號欄位",
          cursorHints: [
            { target: "devices.claimInput", gesture: "tap" },
            { target: "devices.claimButton", gesture: "tap" }
          ],
          requiresConfirmation: false
        }
      ]
    };
  }

  if (mentionsHouseSpaceTopic(message)) {
    return {
      message: [
        "房屋與空間會在「個人 > 房屋」管理。",
        "",
        "你可以先新增房屋，再進入房屋裡新增空間。之後到裝置設定即可把裝置放到某個房屋與空間。"
      ].join("\n"),
      actions: [
        {
          type: "navigate",
          route: "houses",
          description: "帶使用者到房屋管理頁",
          cursorHints: [
            { target: "tab.profile", gesture: "tap" },
            { target: "profile.houses", gesture: "tap" }
          ],
          requiresConfirmation: false
        }
      ]
    };
  }

  if (mentionsProfileTopic(message)) {
    return {
      message: [
        "個人資料會在「帳號管理」頁修改。",
        "",
        "我可以帶你到帳號管理頁，但不會擅自幫你修改 email、顯示名稱、密碼或註銷帳號。",
        "到頁面後，你可以自行輸入資料並儲存。"
      ].join("\n"),
      actions: [
        {
          type: "navigate",
          route: "account",
          description: "帶使用者到帳號管理頁",
          cursorHints: [
            { target: "tab.profile", gesture: "tap" },
            { target: "profile.account", gesture: "tap" }
          ],
          requiresConfirmation: false
        }
      ]
    };
  }

  if (mentionsDataChartTopic(message)) {
    return {
      message: [
        "查看長期數據要到「數據」頁。",
        "",
        "為了避免 Homi 選錯裝置，如果你要我直接幫你套用圖表查詢，請指定裝置暱稱或產品編號，例如 `P-DEMO-0001 近 24 小時功率圖表`。",
        "如果只問某個空間狀態，我會先用文字摘要整理目前狀態。"
      ].join("\n"),
      actions: [
        {
          type: "navigate",
          route: "data",
          description: "帶使用者到數據頁",
          cursorHints: [{ target: "tab.data", gesture: "tap" }],
          requiresConfirmation: false
        },
        {
          type: "show_toast",
          message: "指定裝置、欄位與時間後即可查詢圖表",
          tone: "info",
          description: "提示數據頁查詢條件",
          cursorHints: [
            { target: "data.devicePicker", gesture: "tap" },
            { target: "data.metricPicker", gesture: "tap" },
            { target: "data.timeRange", gesture: "tap" },
            { target: "data.queryButton", gesture: "tap" }
          ],
          requiresConfirmation: false
        }
      ]
    };
  }

  if (mentionsRelayTopic(message)) {
    return {
      message: [
        "智慧插座可以在首頁的 P 系列區塊控制。",
        "",
        "如果你要我幫你開關插座，請明確指定插座暱稱、產品編號，或能唯一對應到一個 P 系列插座的房屋/空間。"
      ].join("\n"),
      actions: [
        {
          type: "navigate",
          route: "home",
          description: "帶使用者到首頁查看智慧插座",
          cursorHints: [{ target: "tab.home", gesture: "tap" }],
          requiresConfirmation: false
        }
      ]
    };
  }

  if (mentionsPreferenceTopic(message)) {
    return {
      message: [
        "裝置顯示模式與開發者模式都在「個人」頁。",
        "",
        "- 裝置顯示模式可以在「系列」與「空間」之間切換。",
        "- 開發者模式會讓數據頁顯示 raw、ADC、腳位與診斷欄位。"
      ].join("\n"),
      actions: [
        {
          type: "navigate",
          route: "profile",
          description: "帶使用者到個人頁查看偏好設定",
          cursorHints: [{ target: "tab.profile", gesture: "tap" }],
          requiresConfirmation: false
        },
        {
          type: "show_toast",
          message: "這裡可以切換裝置顯示模式與開發者模式",
          tone: "info",
          description: "提示偏好設定區塊",
          cursorHints: [
            { target: "profile.deviceGroupMode", gesture: "tap" },
            { target: "profile.developerMode", gesture: "tap" }
          ],
          requiresConfirmation: false
        }
      ]
    };
  }

  return null;
}

function createFallbackRelayPlan(
  context: HomiContext,
  message: string,
  source: AgentPlan["source"] = "fallback",
  relayStateOverride?: boolean | null
): AgentPlan {
  const pDevices = context.devices.filter((device) => device.series === "p_series");
  const relayOn = relayStateOverride ?? inferRelayState(message);

  if (relayOn === null) {
    return askPlan(
      "你想要開啟還是關閉智慧插座？",
      pDevices.map((device) => ({ label: device.nickname, value: device.id })),
      source
    );
  }

  if (message.includes("所有") || message.includes("全部")) {
    return {
      assistantMessage: "批次控制插座需要逐台確認。請先指定一個插座，我會幫你完成確認流程。",
      actions: [
        createAction({
          type: "ask_clarification",
          question: "請選擇要控制的插座",
          options: pDevices.map((device) => ({ label: device.nickname, value: device.id })),
          description: "批次 relay 控制需要釐清成單一插座",
          cursorHints: [{ target: "tab.home", gesture: "tap" }],
          requiresConfirmation: false
        })
      ],
      source,
      warnings: []
    };
  }

  const resolution = resolveDevices(context, message, { pOnly: true });
  const candidates = resolution.candidates;

  if (candidates.length !== 1) {
    return askPlan(
      buildDeviceClarificationQuestion(resolution, "智慧插座"),
      (candidates.length > 1 ? candidates : pDevices).map((device) => ({
        label: formatDeviceOption(device),
        value: device.id
      })),
      source
    );
  }

  const device = candidates[0];
  const currentRelayState = getKnownRelayState(device);
  if (currentRelayState === relayOn) {
    return createRelayAlreadySatisfiedPlan(device, relayOn, source);
  }

  const actionWord = relayOn ? "開啟" : "關閉";

  return {
    assistantMessage: `我會幫你${actionWord}「${device.nickname}」。`,
    actions: [
      createAction({
        type: "focus_home_relay",
        deviceId: device.id,
        expandRelayList: true,
        description: `聚焦 ${device.nickname}`,
        cursorHints: [
          { target: "tab.home", gesture: "tap" },
          { target: `home.relay.${device.id}`, gesture: "move" },
          { target: `home.relay.${device.id}`, gesture: "tap" }
        ],
        requiresConfirmation: false
      }),
      createAction({
        type: "request_relay_confirmation",
        deviceId: device.id,
        deviceName: device.nickname,
        relayOn,
        description: `${actionWord} ${device.nickname}`,
        cursorHints: [
          { target: `home.relay.${device.id}`, gesture: "press" },
          { target: `home.relay.${device.id}`, gesture: "confirm" }
        ],
        requiresConfirmation: false
      })
    ],
    source,
    warnings: []
  };
}

function createRelayAlreadySatisfiedPlan(
  device: HomiDeviceContext,
  relayOn: boolean,
  source: AgentPlan["source"]
): AgentPlan {
  const stateText = relayOn ? "開啟" : "關閉";

  return {
    assistantMessage: `「${device.nickname}」已經是${stateText}狀態。`,
    actions: [
      createAction({
        type: "focus_home_relay",
        deviceId: device.id,
        expandRelayList: true,
        description: `顯示 ${device.nickname} 目前已是${stateText}`,
        cursorHints: [
          { target: "tab.home", gesture: "tap" },
          { target: `home.relay.${device.id}`, gesture: "move" }
        ],
        requiresConfirmation: false
      })
    ],
    source,
    warnings: []
  };
}

async function createFallbackDataPlan(
  context: HomiContext,
  message: string,
  source: AgentPlan["source"] = "fallback"
): Promise<AgentPlan> {
  const metric = inferMetricFromMessage(message);
  const explicitResolution = resolveExplicitDeviceReferences(context, message, { pOnly: false });
  let candidates = explicitResolution.candidates;

  if (metric && candidates.length > 0) {
    const metricDevices = candidates.filter((device) => deviceSupportsMetric(device, metric));
    if (metricDevices.length > 0) {
      candidates = metricDevices;
    }
  }

  if (candidates.length === 0) {
    const resolution = resolveDevices(context, message, { pOnly: false, metric: metric ?? undefined });
    const fallbackCandidates = metric
      ? context.devices.filter((device) => deviceSupportsMetric(device, metric))
      : context.devices;
    const locationPrefix = resolution.reason === "actual_location" || resolution.reason === "ambiguous_location_alias"
      ? "如果要由我打開數據圖表，請指定裝置暱稱或產品編號。"
      : "請指定裝置暱稱或產品編號。";

    return askPlan(
      metric
        ? `${locationPrefix}你想查看哪一台裝置的 ${metricLabelsForPrompt(metric)}？`
        : `${locationPrefix}你想查詢哪一台裝置？`,
      fallbackCandidates.map((device) => ({ label: formatDeviceOption(device), value: device.id })),
      source
    );
  }

  if (candidates.length > 1) {
    return askPlan(
      "我找到多台符合名稱或產品編號的裝置，請選擇要查看哪一台。",
      candidates.map((candidate) => ({ label: formatDeviceOption(candidate), value: candidate.id })),
      source
    );
  }

  const device = candidates[0];
  const selectedMetric = metric ?? firstMetric(device.latestMetrics) ?? firstSeriesMetric(device.series);

  if (!selectedMetric || !deviceSupportsMetric(device, selectedMetric)) {
    return askPlan(
      `請選擇要查看「${device.nickname}」的哪個感測欄位。`,
      getDeviceMetricOptions(device).map((metricKey) => ({ label: metricKey, value: metricKey })),
      source
    );
  }

  const range = inferRange(message);
  const summary = await summarizeReadings(context, device.id, selectedMetric, range);

  return {
    assistantMessage: `${summary} 我也幫你打開數據頁並套用查詢條件。`,
    actions: [
      createAction({
        type: "navigate",
        route: "data",
        description: "切換到數據頁",
        cursorHints: [{ target: "tab.data", gesture: "tap" }],
        requiresConfirmation: false
      }),
      createAction({
        type: "set_data_query",
        deviceId: device.id,
        metric: selectedMetric,
        rangeMode: range.rangeMode,
        customFrom: range.customFrom,
        customTo: range.customTo,
        displayMode: "chart",
        autoRun: true,
        description: `查詢 ${device.nickname} 的 ${selectedMetric}`,
        cursorHints: [
          { target: "data.devicePicker", gesture: "tap" },
          { target: "data.metricPicker", gesture: "tap" },
          { target: "data.timeRange", gesture: "tap" },
          { target: "data.queryButton", gesture: "tap" }
        ],
        requiresConfirmation: false
      })
    ],
    source,
    warnings: []
  };
}

function createFallbackNavigationPlan(
  message: string,
  source: AgentPlan["source"] = "fallback"
): AgentPlan {
  const route = inferRoute(message);
  const routeLabel = route === "houses" ? "房屋" : route === "account" ? "帳號管理" : route;
  const target = route === "home" || route === "devices" || route === "data" || route === "profile"
    ? `tab.${route}` as CursorHint["target"]
    : "tab.profile";

  return {
    assistantMessage: `我帶你到${routeLabel}頁面。`,
    actions: [
      createAction({
        type: "navigate",
        route,
        description: `切換到 ${routeLabel}`,
        cursorHints: [{ target, gesture: "tap" }],
        requiresConfirmation: false
      })
    ],
    source,
    warnings: []
  };
}

function normalizeRawPlan(
  rawPlan: RawAgentPlan,
  context: HomiContext,
  input: AgentMessageInput,
  source: AgentPlan["source"],
  model?: string
): AgentPlan {
  const warnings: string[] = [];
  const assistantMessage =
    typeof rawPlan.assistantMessage === "string" && rawPlan.assistantMessage.trim()
      ? rawPlan.assistantMessage.trim()
      : "我整理好下一步了。";
  const intent = normalizeIntent(rawPlan.intent, warnings);
  const rawActions = Array.isArray(rawPlan.actions) ? rawPlan.actions : [];
  const actions: HomiAction[] = [];

  for (const [index, rawAction] of rawActions.entries()) {
    const action = normalizeAction(rawAction, context, index, warnings);
    if (action) {
      actions.push(action);
    }
  }

  const intentAlignedActions = alignActionsWithModelIntent(
    sanitizeActionSequence(actions, warnings),
    intent,
    warnings
  );
  const sanitizedActions = intent?.needsAppAction === false
    ? intentAlignedActions
    : enforceActionPolicy(
        intentAlignedActions,
        context,
        input,
        warnings
      );

  if (sanitizedActions.length === 0) {
    sanitizedActions.push(createAction({
      type: "say",
      message: assistantMessage,
      description: "只回覆文字",
      cursorHints: [],
      requiresConfirmation: false
    }));
  }

  const policyAssistantMessage = policyAssistantMessageForActions(sanitizedActions);

  return {
    assistantMessage: policyAssistantMessage ?? assistantMessage,
    actions: sanitizedActions,
    intent,
    model,
    source,
    warnings
  };
}

function normalizeIntent(rawIntent: unknown, warnings: string[]): HomiIntent | undefined {
  if (!isRecord(rawIntent)) {
    warnings.push("AI response missing intent; actions will rely on standard validators");
    return undefined;
  }

  const rawCategory = typeof rawIntent.category === "string"
    ? rawIntent.category
    : typeof rawIntent.type === "string"
      ? rawIntent.type
      : null;
  const category = rawCategory && allowedIntentCategories.has(rawCategory as HomiIntentCategory)
    ? rawCategory as HomiIntentCategory
    : null;

  if (!category) {
    warnings.push(`AI response intent category is invalid: ${String(rawCategory)}`);
    return undefined;
  }

  return {
    category,
    needsAppAction: rawIntent.needsAppAction === true,
    confidence: typeof rawIntent.confidence === "number"
      ? Math.max(0, Math.min(1, rawIntent.confidence))
      : undefined,
    reason: typeof rawIntent.reason === "string" ? rawIntent.reason.slice(0, 500) : undefined
  };
}

function alignActionsWithModelIntent(
  actions: HomiAction[],
  intent: HomiIntent | undefined,
  warnings: string[]
) {
  if (intent?.needsAppAction !== false) {
    return actions;
  }

  const passiveActions = actions.filter((action) =>
    action.type === "say" || action.type === "ask_clarification"
  );
  const droppedCount = actions.length - passiveActions.length;

  if (droppedCount > 0) {
    warnings.push(
      `dropped ${droppedCount} app action(s) because the model classified the request as information_only/no-app-action`
    );
  }

  return passiveActions;
}

function sanitizeActionSequence(actions: HomiAction[], warnings: string[]) {
  const firstClarificationIndex = actions.findIndex((action) => action.type === "ask_clarification");

  if (firstClarificationIndex >= 0) {
    const clarificationActions = actions.filter((action) => action.type === "ask_clarification");
    const droppedCount = actions.length - clarificationActions.length;
    if (droppedCount > 0) {
      warnings.push(`dropped ${droppedCount} action(s) because clarification is required`);
    }
    return clarificationActions;
  }

  return actions;
}

function enforceActionPolicy(
  actions: HomiAction[],
  context: HomiContext,
  input: AgentMessageInput,
  warnings: string[]
) {
  if (actions.some((action) => action.type === "ask_clarification")) {
    return promoteClarificationIfSafe(actions, context, input, warnings)
      ?? sanitizeActionSequence(actions, warnings);
  }

  const relayActions = actions.filter((action) =>
    action.type === "focus_home_relay" || action.type === "request_relay_confirmation"
  );
  if (relayActions.length > 0) {
    return enforceRelayPolicy(relayActions, context, input, warnings) ?? actions;
  }

  const recoveredRelayActions = recoverRelayActionFromMessage(context, input, warnings);
  if (recoveredRelayActions) {
    return recoveredRelayActions;
  }

  const dataActions = actions.filter((action): action is Extract<HomiAction, { type: "set_data_query" }> =>
    action.type === "set_data_query"
  );
  if (dataActions.length > 0) {
    return enforceDataQueryPolicy(dataActions, context, input, warnings) ?? actions;
  }

  return actions;
}

function recoverRelayActionFromMessage(
  context: HomiContext,
  input: AgentMessageInput,
  warnings: string[]
) {
  const normalizedMessage = normalizeText(input.message);

  if (!isRelayIntent(normalizedMessage) || !mentionsRelayTarget(normalizedMessage)) {
    return null;
  }

  const relayOn = inferRelayStateFromInput(normalizedMessage, input);
  const safeRelayPlan = createSafeRelayPlanFromMessage(context, normalizedMessage, relayOn);

  if (!safeRelayPlan) {
    return null;
  }

  warnings.push("recovered relay action from explicit user message after model action normalization");
  return safeRelayPlan.actions;
}

function promoteClarificationIfSafe(
  actions: HomiAction[],
  context: HomiContext,
  input: AgentMessageInput,
  warnings: string[]
) {
  const normalizedMessage = normalizeText(input.message);
  const relayOn = inferRelayStateFromInput(normalizedMessage, input);

  if (relayOn !== null && mentionsRelayTarget(normalizedMessage)) {
    const relayPlan = createSafeRelayPlanFromMessage(context, normalizedMessage, relayOn);
    if (relayPlan) {
      warnings.push("promoted clarification to relay action because the user message resolved to one explicit plug");
      return relayPlan.actions;
    }
  }

  return null;
}

function createSafeRelayPlanFromMessage(
  context: HomiContext,
  normalizedMessage: string,
  relayStateOverride?: boolean | null
) {
  const resolution = resolveDevices(context, normalizedMessage, { pOnly: true });
  const relayOn = relayStateOverride ?? inferRelayState(normalizedMessage);
  const explicitDevice = resolution.reason === "explicit_device";
  const actualLocationWithRelayTarget =
    resolution.reason === "actual_location" && mentionsRelayTarget(normalizedMessage);

  if (
    relayOn === null ||
    resolution.candidates.length !== 1 ||
    (!explicitDevice && !actualLocationWithRelayTarget)
  ) {
    return null;
  }

  return createFallbackRelayPlan(context, normalizedMessage, "ai", relayOn);
}

function mentionsRelayTarget(message: string) {
  return (
    message.includes("插座") ||
    message.includes("智慧插座") ||
    message.includes("relay") ||
    message.includes("p系列") ||
    message.includes("p系") ||
    message.includes("p-demo")
  );
}

function enforceRelayPolicy(
  relayActions: HomiAction[],
  context: HomiContext,
  input: AgentMessageInput,
  warnings: string[]
) {
  const normalizedMessage = normalizeText(input.message);
  const pDevices = context.devices.filter((device) => device.series === "p_series");
  const resolution = resolveDevices(context, normalizedMessage, { pOnly: true });
  const relayOn = inferRelayStateFromInput(normalizedMessage, input);
  const relayAction = relayActions.find((action): action is Extract<HomiAction, { type: "request_relay_confirmation" }> =>
    action.type === "request_relay_confirmation"
  );
  const safeRelayPlan = createSafeRelayPlanFromMessage(context, normalizedMessage, relayOn);
  const resolvedDevice = safeRelayPlan?.actions.find(
    (action): action is Extract<HomiAction, { type: "request_relay_confirmation" }> =>
      action.type === "request_relay_confirmation"
  );
  const alreadySatisfied = Boolean(safeRelayPlan && !resolvedDevice);

  if (safeRelayPlan && alreadySatisfied) {
    warnings.push("relay action converted to already-satisfied response because target state already matches request");
    return safeRelayPlan.actions;
  }

  if (!safeRelayPlan || !resolvedDevice || relayOn === null) {
    warnings.push("relay action blocked because the user message did not resolve to one explicit P series device");
    const question = relayOn === null
      ? "你想要開啟還是關閉哪一個智慧插座？"
      : `你想要${relayOn ? "開啟" : "關閉"}哪一個智慧插座？`;

    return [
      createAction({
        type: "ask_clarification",
        question,
        options: pDevices.map((device) => ({ label: formatDeviceOption(device), value: device.id })),
        description: "Relay 控制需要明確指定單一智慧插座",
        cursorHints: [{ target: "center", gesture: "move" }],
        requiresConfirmation: false
      })
    ];
  }

  if (!relayAction || relayAction.deviceId !== resolvedDevice.deviceId || relayAction.relayOn !== relayOn) {
    warnings.push("relay action replaced by backend-safe relay plan");
  }

  return safeRelayPlan.actions;
}

function enforceDataQueryPolicy(
  dataActions: Array<Extract<HomiAction, { type: "set_data_query" }>>,
  context: HomiContext,
  input: AgentMessageInput,
  warnings: string[]
) {
  const normalizedMessage = normalizeText(input.message);
  const dataAction = dataActions[0];
  const resolution = resolveExplicitDeviceReferences(context, normalizedMessage, { pOnly: false });
  const resolvedDevice = resolution.candidates.length === 1 ? resolution.candidates[0] : null;
  const metricLabel = metricLabelsForPrompt(dataAction.metric);

  if (
    resolution.reason === "explicit_device" &&
    resolvedDevice &&
    dataAction.deviceId === resolvedDevice.id &&
    !deviceSupportsMetric(resolvedDevice, dataAction.metric)
  ) {
    warnings.push("data query action blocked because the explicit device does not support the requested metric");
    const fallbackDevices = context.devices.filter((device) => deviceSupportsMetric(device, dataAction.metric));
    const supportedMetricText = getDeviceMetricOptions(resolvedDevice)
      .map(metricLabelsForPrompt)
      .join("、");

    return [
      createAction({
        type: "ask_clarification",
        question: `「${resolvedDevice.nickname}」不支援${metricLabel}資料。這台裝置可查看：${supportedMetricText || "目前沒有可查詢欄位"}。如果你要看${metricLabel}，請選擇其他支援的裝置。`,
        options: fallbackDevices.map((device) => ({ label: formatDeviceOption(device), value: device.id })),
        description: "指定裝置不支援該感測欄位",
        cursorHints: [{ target: "data.devicePicker", gesture: "tap" }],
        requiresConfirmation: false
      })
    ];
  }

  if (
    resolution.reason !== "explicit_device" ||
    !resolvedDevice ||
    dataAction.deviceId !== resolvedDevice.id ||
    !deviceSupportsMetric(resolvedDevice, dataAction.metric)
  ) {
    warnings.push("data query action blocked because chart operations require an explicit device nickname, productCode, or deviceId");
    const fallbackDevices = dataAction.metric
      ? context.devices.filter((device) => deviceSupportsMetric(device, dataAction.metric))
      : context.devices;

    return [
      createAction({
        type: "ask_clarification",
        question: `如果要由我打開數據圖表，請先指定裝置暱稱或產品編號。你想查看哪一台裝置的 ${metricLabel}？`,
        options: (fallbackDevices.length > 0 ? fallbackDevices : context.devices)
          .map((device) => ({ label: formatDeviceOption(device), value: device.id })),
        description: "資料查詢需要明確指定裝置與感測欄位",
        cursorHints: [{ target: "data.devicePicker", gesture: "tap" }],
        requiresConfirmation: false
      })
    ];
  }

  return null;
}

function policyAssistantMessageForActions(actions: HomiAction[]) {
  const clarificationAction = actions.find((action): action is Extract<HomiAction, { type: "ask_clarification" }> =>
    action.type === "ask_clarification"
  );

  if (clarificationAction) {
    return clarificationAction.question;
  }

  const relayAction = actions.find((action): action is Extract<HomiAction, { type: "request_relay_confirmation" }> =>
    action.type === "request_relay_confirmation"
  );

  if (relayAction) {
    return `我會幫你${relayAction.relayOn ? "開啟" : "關閉"}「${relayAction.deviceName}」。`;
  }

  const alreadySatisfiedFocusAction = actions.find(
    (action): action is Extract<HomiAction, { type: "focus_home_relay" }> =>
      action.type === "focus_home_relay" && action.description.includes("目前已是")
  );

  if (alreadySatisfiedFocusAction) {
    const match = alreadySatisfiedFocusAction.description.match(/^顯示\s+(.+)\s+目前已是(開啟|關閉)$/);
    if (match) {
      return `「${match[1]}」已經是${match[2]}狀態。`;
    }
  }

  return null;
}

function normalizeAction(
  rawAction: unknown,
  context: HomiContext,
  index: number,
  warnings: string[]
): HomiAction | null {
  if (!isRecord(rawAction) || typeof rawAction.type !== "string") {
    warnings.push(`action ${index} is not an object`);
    return null;
  }

  const base = {
    id: typeof rawAction.id === "string" && rawAction.id.trim() ? rawAction.id.trim() : `homi-${index}-${randomUUID()}`,
    description: typeof rawAction.description === "string" ? rawAction.description : "Homi action",
    cursorHints: normalizeCursorHints(rawAction.cursorHints, context),
    requiresConfirmation: Boolean(rawAction.requiresConfirmation)
  };

  switch (rawAction.type) {
    case "say":
      return createAction({
        ...base,
        type: "say",
        message: typeof rawAction.message === "string" ? rawAction.message : undefined,
        requiresConfirmation: false
      });
    case "ask_clarification":
      return createAction({
        ...base,
        type: "ask_clarification",
        question: typeof rawAction.question === "string" ? rawAction.question : "請再補充你想操作的裝置或時間。",
        options: normalizeOptions(rawAction.options),
        requiresConfirmation: false
      });
    case "navigate": {
      const route = typeof rawAction.route === "string" && allowedRoutes.has(rawAction.route as AgentRoute)
        ? rawAction.route as AgentRoute
        : null;

      if (!route) {
        warnings.push(`navigate route is invalid: ${String(rawAction.route)}`);
        return null;
      }

      return createAction({
        ...base,
        type: "navigate",
        route,
        cursorHints: base.cursorHints.length > 0 ? base.cursorHints : defaultCursorHintsForRoute(route),
        requiresConfirmation: false
      });
    }
    case "set_data_query": {
      const device = getContextDevice(context, rawAction.deviceId);
      const metric = typeof rawAction.metric === "string" && isAllowedMetric(context, rawAction.metric)
        ? rawAction.metric
        : null;
      const rangeMode = typeof rawAction.rangeMode === "string" && allowedRangeModes.has(rawAction.rangeMode as DataRangeMode)
        ? rawAction.rangeMode as DataRangeMode
        : "24h";
      const displayMode = typeof rawAction.displayMode === "string" && allowedDisplayModes.has(rawAction.displayMode as DataDisplayMode)
        ? rawAction.displayMode as DataDisplayMode
        : "chart";

      if (!device || !metric) {
        warnings.push("set_data_query missing owned deviceId or allowed metric");
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "請選擇要查詢的裝置與感測欄位。",
          options: context.devices.map((candidate) => ({
            label: formatDeviceOption(candidate),
            value: candidate.id
          })),
          cursorHints: [{ target: "data.devicePicker", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      return createAction({
        ...base,
        type: "set_data_query",
        deviceId: device.id,
        metric,
        rangeMode,
        customFrom: parseOptionalDate(rawAction.customFrom),
        customTo: parseOptionalDate(rawAction.customTo),
        displayMode,
        autoRun: rawAction.autoRun !== false,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "data.devicePicker", gesture: "tap" },
              { target: "data.metricPicker", gesture: "tap" },
              { target: "data.queryButton", gesture: "tap" }
            ],
        requiresConfirmation: false
      });
    }
    case "focus_home_relay": {
      const device = getContextDevice(context, rawAction.deviceId);
      if (!device || device.series !== "p_series") {
        warnings.push("focus_home_relay target is not an owned P series device");
        return null;
      }

      return createAction({
        ...base,
        type: "focus_home_relay",
        deviceId: device.id,
        expandRelayList: rawAction.expandRelayList !== false,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "tab.home", gesture: "tap" },
              { target: `home.relay.${device.id}`, gesture: "move" }
            ],
        requiresConfirmation: false
      });
    }
    case "focus_home_device": {
      const device = getContextDevice(context, rawAction.deviceId);
      if (!device) {
        warnings.push("focus_home_device target is not an owned device");
        return null;
      }

      return createAction({
        ...base,
        type: "focus_home_device",
        deviceId: device.id,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "tab.home", gesture: "tap" },
              { target: `home.device.${device.id}`, gesture: "move" }
            ],
        requiresConfirmation: false
      });
    }
    case "request_relay_confirmation": {
      const device = getContextDevice(context, rawAction.deviceId);
      if (!device || device.series !== "p_series") {
        warnings.push("request_relay_confirmation target is not an owned P series device");
        return createAction({
          ...base,
          type: "show_toast",
          message: "只有 P 系列智慧插座可以控制開關。",
          tone: "warning",
          cursorHints: [{ target: "tab.home", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      if (typeof rawAction.relayOn !== "boolean") {
        warnings.push("request_relay_confirmation missing relayOn boolean");
        return null;
      }

      return createAction({
        ...base,
        type: "request_relay_confirmation",
        deviceId: device.id,
        deviceName: typeof rawAction.deviceName === "string" ? rawAction.deviceName : device.nickname,
        relayOn: rawAction.relayOn,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [{ target: `home.relay.${device.id}`, gesture: "confirm" }],
        requiresConfirmation: false
      });
    }
    case "show_toast":
      return createAction({
        ...base,
        type: "show_toast",
        message: typeof rawAction.message === "string" ? rawAction.message : "操作已完成",
        tone: normalizeTone(rawAction.tone),
        requiresConfirmation: false
      });
    case "set_preference": {
      const developerMode = typeof rawAction.developerMode === "boolean"
        ? rawAction.developerMode
        : undefined;
      const deviceGroupMode = typeof rawAction.deviceGroupMode === "string" && allowedDeviceGroupModes.has(rawAction.deviceGroupMode)
        ? rawAction.deviceGroupMode as "series" | "space"
        : undefined;

      if (developerMode === undefined && deviceGroupMode === undefined) {
        warnings.push("set_preference missing supported preference value");
        return null;
      }

      return createAction({
        ...base,
        type: "set_preference",
        developerMode,
        deviceGroupMode,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [{ target: deviceGroupMode ? "profile.deviceGroupMode" : "profile.developerMode", gesture: "tap" }],
        requiresConfirmation: false
      });
    }
    case "open_device_settings": {
      const device = getContextDevice(context, rawAction.deviceId);
      if (!device) {
        warnings.push("open_device_settings missing owned deviceId");
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "請選擇要設定哪一台裝置。",
          options: context.devices.map((candidate) => ({
            label: formatDeviceOption(candidate),
            value: candidate.id
          })),
          cursorHints: [{ target: "devices.devicePicker", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      return createAction({
        ...base,
        type: "open_device_settings",
        deviceId: device.id,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "tab.devices", gesture: "tap" },
              { target: `devices.device.${device.id}`, gesture: "tap" }
            ],
        requiresConfirmation: false
      });
    }
    case "set_device_profile": {
      const device = getContextDevice(context, rawAction.deviceId);
      if (!device) {
        warnings.push("set_device_profile missing owned deviceId");
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "請選擇要更新哪一台裝置。",
          options: context.devices.map((candidate) => ({
            label: formatDeviceOption(candidate),
            value: candidate.id
          })),
          cursorHints: [{ target: "devices.devicePicker", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      const normalizedLocation = normalizeHouseSpaceInput(context, rawAction.houseId, rawAction.spaceId);
      if (normalizedLocation.invalid) {
        warnings.push(`set_device_profile invalid house/space: ${normalizedLocation.invalid}`);
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "這個房屋或空間不存在，請先選擇既有房屋/空間，或先請我新增房屋與空間。",
          options: context.houses.map((house) => ({ label: house.name, value: house.id })),
          cursorHints: [{ target: "devices.sheet.house", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      const alias = Object.prototype.hasOwnProperty.call(rawAction, "alias")
        ? normalizeNullableName(rawAction.alias, 40)
        : undefined;
      const hasHouse = Object.prototype.hasOwnProperty.call(rawAction, "houseId");
      const hasSpace = Object.prototype.hasOwnProperty.call(rawAction, "spaceId");

      if (alias === undefined && !hasHouse && !hasSpace) {
        warnings.push("set_device_profile did not include alias, houseId, or spaceId");
        return null;
      }

      return createAction({
        ...base,
        type: "set_device_profile",
        deviceId: device.id,
        alias,
        houseId: hasHouse || hasSpace ? normalizedLocation.houseId : undefined,
        spaceId: hasHouse || hasSpace ? normalizedLocation.spaceId : undefined,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "tab.devices", gesture: "tap" },
              { target: `devices.device.${device.id}`, gesture: "tap" },
              { target: "devices.sheet.save", gesture: "confirm" }
            ],
        requiresConfirmation: false
      });
    }
    case "claim_device": {
      const productCode = normalizeProductCode(rawAction.productCode);
      if (!productCode) {
        warnings.push("claim_device missing productCode");
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "請提供要綁定的產品編號。",
          cursorHints: [{ target: "devices.claimInput", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      return createAction({
        ...base,
        type: "claim_device",
        productCode,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "tab.devices", gesture: "tap" },
              { target: "devices.claimInput", gesture: "tap" },
              { target: "devices.claimButton", gesture: "confirm" }
            ],
        requiresConfirmation: false
      });
    }
    case "open_house_detail": {
      const house = getContextHouse(context, rawAction.houseId);
      if (!house) {
        warnings.push("open_house_detail missing owned houseId");
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "請選擇要開啟哪一棟房屋。",
          options: context.houses.map((candidate) => ({ label: candidate.name, value: candidate.id })),
          cursorHints: [{ target: "profile.houses", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      return createAction({
        ...base,
        type: "open_house_detail",
        houseId: house.id,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "profile.houses", gesture: "tap" },
              { target: `houses.house.${house.id}`, gesture: "tap" }
            ],
        requiresConfirmation: false
      });
    }
    case "create_house": {
      const name = normalizeRequiredName(rawAction.name, 40);
      if (!name) {
        warnings.push("create_house missing name");
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "請提供要新增的房屋名稱。",
          cursorHints: [{ target: "houses.create", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      return createAction({
        ...base,
        type: "create_house",
        name,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: "profile.houses", gesture: "tap" },
              { target: "houses.create", gesture: "confirm" }
            ],
        requiresConfirmation: false
      });
    }
    case "create_space": {
      const house = getContextHouse(context, rawAction.houseId);
      const name = normalizeRequiredName(rawAction.name, 40);
      if (!house || !name) {
        warnings.push("create_space missing owned houseId or name");
        return createAction({
          ...base,
          type: "ask_clarification",
          question: "請選擇要在哪一棟房屋新增空間，並提供空間名稱。",
          options: context.houses.map((candidate) => ({ label: candidate.name, value: candidate.id })),
          cursorHints: [{ target: "profile.houses", gesture: "tap" }],
          requiresConfirmation: false
        });
      }

      return createAction({
        ...base,
        type: "create_space",
        houseId: house.id,
        name,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: `houses.house.${house.id}`, gesture: "tap" },
              { target: "houses.space.create", gesture: "confirm" }
            ],
        requiresConfirmation: false
      });
    }
    case "rename_house": {
      const house = getContextHouse(context, rawAction.houseId);
      const name = normalizeRequiredName(rawAction.name, 40);
      if (!house || !name) {
        warnings.push("rename_house missing owned houseId or name");
        return null;
      }

      return createAction({
        ...base,
        type: "rename_house",
        houseId: house.id,
        name,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: `houses.house.${house.id}`, gesture: "tap" },
              { target: "houses.house.rename", gesture: "confirm" }
            ],
        requiresConfirmation: false
      });
    }
    case "rename_space": {
      const house = getContextHouse(context, rawAction.houseId);
      const space = house ? getHouseSpace(house, rawAction.spaceId) : null;
      const name = normalizeRequiredName(rawAction.name, 40);
      if (!house || !space || !name) {
        warnings.push("rename_space missing owned houseId, spaceId, or name");
        return null;
      }

      return createAction({
        ...base,
        type: "rename_space",
        houseId: house.id,
        spaceId: space.id,
        name,
        cursorHints: base.cursorHints.length > 0
          ? base.cursorHints
          : [
              { target: `houses.house.${house.id}`, gesture: "tap" },
              { target: `houses.space.${space.id}`, gesture: "tap" },
              { target: "houses.space.rename", gesture: "confirm" }
            ],
        requiresConfirmation: false
      });
    }
    default:
      warnings.push(`unknown action type: ${rawAction.type}`);
      return null;
  }
}

function createAction<TAction extends HomiActionInput>(
  action: TAction
): HomiAction {
  return {
    ...action,
    id: action.id ?? randomUUID()
  } as HomiAction;
}

function normalizeCursorHints(value: unknown, context: HomiContext): CursorHint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((hint) => {
    if (!isRecord(hint) || typeof hint.target !== "string" || typeof hint.gesture !== "string") {
      return [];
    }

    const gesture = ["move", "tap", "press", "confirm"].includes(hint.gesture)
      ? hint.gesture as CursorHint["gesture"]
      : null;
    const target = normalizeCursorTarget(hint.target, context);

    return gesture && target ? [{ target, gesture }] : [];
  }).slice(0, 8);
}

function normalizeCursorTarget(target: string, context: HomiContext): CursorHint["target"] | null {
  const directTargets = new Set<string>([
    "center",
    "tab.home",
    "tab.devices",
    "tab.data",
    "tab.profile",
    "data.devicePicker",
    "data.metricPicker",
    "data.timeRange",
    "data.displayMode",
    "data.queryButton",
    "devices.claimInput",
    "devices.claimButton",
    "devices.devicePicker",
    "devices.sheet.alias",
    "devices.sheet.house",
    "devices.sheet.space",
    "devices.sheet.save",
    "profile.account",
    "profile.houses",
    "profile.deviceGroupMode",
    "profile.developerMode",
    "houses.create",
    "houses.house.rename",
    "houses.space.create",
    "houses.space.rename"
  ]);

  if (directTargets.has(target)) {
    return target as CursorHint["target"];
  }

  const relayPrefix = "home.relay.";
  if (target.startsWith(relayPrefix)) {
    const deviceId = target.slice(relayPrefix.length);
    const device = context.devices.find((candidate) => candidate.id === deviceId);
    return device?.series === "p_series" ? target as CursorHint["target"] : null;
  }

  const homeDevicePrefix = "home.device.";
  if (target.startsWith(homeDevicePrefix)) {
    const deviceId = target.slice(homeDevicePrefix.length);
    const device = context.devices.find((candidate) => candidate.id === deviceId);
    return device ? target as CursorHint["target"] : null;
  }

  const devicePrefix = "devices.device.";
  if (target.startsWith(devicePrefix)) {
    const deviceId = target.slice(devicePrefix.length);
    const device = context.devices.find((candidate) => candidate.id === deviceId);
    return device ? target : null;
  }

  const housePrefix = "houses.house.";
  if (target.startsWith(housePrefix)) {
    const houseId = target.slice(housePrefix.length);
    return context.houses.some((house) => house.id === houseId) ? target : null;
  }

  const spacePrefix = "houses.space.";
  if (target.startsWith(spacePrefix)) {
    const spaceId = target.slice(spacePrefix.length);
    return context.houses.some((house) => house.spaces.some((space) => space.id === spaceId))
      ? target
      : null;
  }

  return null;
}

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((option) => {
    if (!isRecord(option) || typeof option.label !== "string" || typeof option.value !== "string") {
      return [];
    }

    return [{ label: option.label, value: option.value }];
  }).slice(0, 8);
}

function normalizeTone(value: unknown): "info" | "success" | "warning" | "error" {
  return value === "success" || value === "warning" || value === "error" ? value : "info";
}

function defaultCursorHintsForRoute(route: AgentRoute): CursorHint[] {
  if (route === "home" || route === "devices" || route === "data" || route === "profile") {
    return [{ target: `tab.${route}`, gesture: "tap" }];
  }

  return [{ target: "tab.profile", gesture: "tap" }];
}

async function summarizeReadings(
  context: HomiContext,
  deviceId: string,
  metric: string,
  range: { rangeMode: DataRangeMode; customFrom?: string; customTo?: string }
) {
  const rawDevice = context.rawDevices.find((device) => device.id === deviceId);
  const device = context.devices.find((candidate) => candidate.id === deviceId);

  if (!rawDevice || !device) {
    return "我找不到這台裝置的歷史資料。";
  }

  const bounds = rangeBounds(range);
  const readings = await getDeviceReadings(rawDevice.seriesKey, rawDevice.deviceId, {
    from: bounds.from,
    to: bounds.to,
    metric,
    limit: 500
  });
  const values = readings
    .map((reading) => reading.values?.[metric])
    .filter((value): value is string | number | boolean =>
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    );

  if (values.length === 0) {
    return `「${device.nickname}」在這個時間區間沒有 ${metric} 資料，不會用 0 參與平均計算。`;
  }

  const firstValue = values[0];

  if (typeof firstValue === "number") {
    const numericValues = values.filter((value): value is number => typeof value === "number");
    const sum = numericValues.reduce((total, value) => total + value, 0);
    const avg = sum / numericValues.length;
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const latest = numericValues[0];

    return `「${device.nickname}」共有 ${numericValues.length} 筆 ${metric}，平均 ${round1(avg)}、最低 ${round1(min)}、最高 ${round1(max)}、最新 ${round1(latest)}。`;
  }

  if (typeof firstValue === "boolean") {
    const booleanValues = values.filter((value): value is boolean => typeof value === "boolean");
    const trueCount = booleanValues.filter(Boolean).length;
    const falseCount = booleanValues.length - trueCount;
    const ratio = Math.round((trueCount / booleanValues.length) * 100);

    return `「${device.nickname}」共有 ${booleanValues.length} 筆 ${metric}，觸發 ${trueCount} 次、未觸發 ${falseCount} 次，觸發比例 ${ratio}%。`;
  }

  return `「${device.nickname}」共有 ${values.length} 筆 ${metric} 類別資料。`;
}

function buildLatestStatusText(context: HomiContext) {
  const onlineCount = context.devices.filter((device) => device.online).length;
  const pDevices = context.devices.filter((device) => device.series === "p_series");
  const relayOnCount = pDevices.filter((device) => device.latestMetrics.relay_on === true).length;
  const alerts: string[] = [];

  for (const device of context.devices) {
    if (seriesSupportsMetric(device, "flame_detected") && device.latestMetrics.flame_detected === true) {
      alerts.push(`${device.nickname} 偵測到火焰`);
    }

    if (seriesSupportsMetric(device, "gas_detected") && device.latestMetrics.gas_detected === true) {
      alerts.push(`${device.nickname} 偵測到氣體警報`);
    }

    if (
      seriesSupportsMetric(device, "eco2_ppm") &&
      typeof device.latestMetrics.eco2_ppm === "number" &&
      device.latestMetrics.eco2_ppm > 1000
    ) {
      alerts.push(`${device.nickname} eCO2 偏高`);
    }
  }

  const alertText = alerts.length > 0
    ? `需要注意：${alerts.slice(0, 3).join("、")}。`
    : "目前沒有看到明顯異常。";

  return `目前已綁定 ${context.devices.length} 台裝置，其中 ${onlineCount} 台有回報資料。P 系列插座 ${relayOnCount}/${pDevices.length} 個為開啟狀態。${alertText}`;
}

function getActualLocationNames(context: HomiContext) {
  const names = new Set<string>();

  for (const house of context.houses) {
    names.add(house.name);

    for (const space of house.spaces) {
      names.add(space.name);
    }
  }

  for (const device of context.devices) {
    if (device.house) {
      names.add(device.house);
    }

    if (device.space) {
      names.add(device.space);
    }
  }

  return Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function resolveActualLocation(context: HomiContext, message: string) {
  const normalizedMessage = normalizeText(message);
  const locations = getActualLocationNames(context)
    .map((name) => ({ name, normalized: normalizeText(name) }))
    .filter((location) => location.normalized.length > 0 && normalizedMessage.includes(location.normalized));

  if (locations.length !== 1) {
    return null;
  }

  return locations[0];
}

function buildLocationStatusText(locationName: string, devices: HomiDeviceContext[]) {
  const lines = [
    `「${locationName}」目前有 ${devices.length} 台裝置：`,
    ""
  ];

  for (const device of devices) {
    lines.push(`- **${device.nickname}**：${buildDeviceStatusSummary(device)}`);
  }

  lines.push("");
  lines.push("你有想要查看特定裝置的長期或即時數據嗎？如果要我打開圖表，請告訴我裝置暱稱或產品編號。");

  return lines.join("\n");
}

function buildDeviceStatusSummary(device: HomiDeviceContext) {
  if (!device.online) {
    return "目前沒有最新回報資料，可能離線或尚未上傳。";
  }

  const values: string[] = [];
  const metricPriority = [
    "temperature_c",
    "humidity_percent",
    "heat_index_c",
    "eco2_ppm",
    "tvoc_ppb",
    "gas_detected",
    "flame_detected",
    "motion_detected",
    "presence_detected",
    "relay_on",
    "power_w",
    "current_a",
    "voltage_v",
    "wifi_rssi"
  ];

  for (const metric of metricPriority) {
    if (!Object.prototype.hasOwnProperty.call(device.latestMetrics, metric)) {
      continue;
    }

    values.push(formatMetricSummary(metric, device.latestMetrics[metric]));
    if (values.length >= 4) {
      break;
    }
  }

  return values.length > 0 ? values.join("，") : "有最新回報，但目前沒有可摘要的公開欄位。";
}

function formatMetricSummary(metric: string, value: unknown) {
  if (typeof value === "boolean") {
    const booleanLabels: Record<string, [string, string]> = {
      gas_detected: ["偵測到氣體", "未偵測到氣體"],
      flame_detected: ["偵測到火焰", "未偵測到火焰"],
      motion_detected: ["偵測到活動", "未偵測到活動"],
      presence_detected: ["偵測到有人", "未偵測到有人"],
      relay_on: ["插座開啟", "插座關閉"]
    };
    const labels = booleanLabels[metric];
    return labels ? (value ? labels[0] : labels[1]) : `${metric}：${value ? "是" : "否"}`;
  }

  if (typeof value === "number") {
    const unitMap: Record<string, string> = {
      temperature_c: "°C",
      humidity_percent: "%",
      heat_index_c: "°C",
      eco2_ppm: " ppm",
      tvoc_ppb: " ppb",
      power_w: " W",
      current_a: " A",
      voltage_v: " V",
      wifi_rssi: " dBm"
    };
    return `${metricLabelsForPrompt(metric)} ${round1(value)}${unitMap[metric] ?? ""}`;
  }

  return `${metricLabelsForPrompt(metric)}：${String(value)}`;
}

function resolveExplicitDeviceReferences(
  context: HomiContext,
  message: string,
  options: { pOnly: boolean }
): DeviceResolution {
  const normalizedMessage = normalizeText(message);
  const sourceDevices = options.pOnly
    ? context.devices.filter((device) => device.series === "p_series")
    : context.devices;
  const matches = sourceDevices.filter((device) => {
    const explicitFields = [
      device.productCode,
      device.deviceId,
      device.nickname
    ]
      .filter(Boolean)
      .map((field) => normalizeText(String(field)))
      .filter((field) => field.length >= 2);

    return explicitFields.some((field) => normalizedMessage.includes(field));
  });

  return {
    candidates: dedupeDevices(matches),
    reason: matches.length > 0 ? "explicit_device" : "none",
    unresolvedTerms: []
  };
}

function resolveDevices(
  context: HomiContext,
  message: string,
  options: { pOnly: boolean; metric?: string }
): DeviceResolution {
  const normalizedMessage = normalizeText(message);
  const sourceDevices = options.pOnly
    ? context.devices.filter((device) => device.series === "p_series")
    : context.devices;
  const exactMatches = sourceDevices.filter((device) => {
    const fields = [
      device.id,
      device.productCode,
      device.deviceId,
      device.nickname,
      device.displayName,
      device.modelName
    ]
      .filter(Boolean)
      .map((field) => normalizeText(String(field)))
      .filter((field) => field.length >= 2);

    return fields.some((field) => normalizedMessage.includes(field));
  });

  if (exactMatches.length > 0) {
    return {
      candidates: dedupeDevices(exactMatches),
      reason: "explicit_device",
      unresolvedTerms: []
    };
  }

  const actualLocationNames = getActualLocationNames(context);
  const actualLocationMatches = actualLocationNames
    .map((name) => ({ raw: name, normalized: normalizeText(name) }))
    .filter(({ normalized }) => normalized && normalizedMessage.includes(normalized));

  if (actualLocationMatches.length > 0) {
    const matches = sourceDevices.filter((device) => {
      const deviceLocations = [device.house, device.space]
        .filter(Boolean)
        .map((name) => normalizeText(String(name)));

      return actualLocationMatches.some(({ normalized }) => deviceLocations.includes(normalized));
    });

    return {
      candidates: dedupeDevices(matches),
      reason: "actual_location",
      unresolvedTerms: []
    };
  }

  const actualLocationSet = new Set(actualLocationNames.map((name) => normalizeText(name)));
  const unresolvedLocationTerms = locationLikeTerms.filter((term) => {
    const normalizedTerm = normalizeText(term);
    return normalizedMessage.includes(normalizedTerm) && !actualLocationSet.has(normalizedTerm);
  });

  if (unresolvedLocationTerms.length > 0) {
    const matches = sourceDevices.filter((device) =>
      unresolvedLocationTerms.some((term) => deviceMatchesAliasTerm(device, term))
    );

    return {
      candidates: dedupeDevices(matches),
      reason: "ambiguous_location_alias",
      unresolvedTerms: unresolvedLocationTerms
    };
  }

  const mentionedSeries = inferExplicitSeries(normalizedMessage);
  if (mentionedSeries) {
    return {
      candidates: sourceDevices.filter((device) => device.series === mentionedSeries),
      reason: "series",
      unresolvedTerms: []
    };
  }

  if (options.metric) {
    const matches = sourceDevices.filter((device) => deviceSupportsMetric(device, options.metric ?? ""));

    if (matches.length > 0) {
      return {
        candidates: matches,
        reason: "metric_capability",
        unresolvedTerms: []
      };
    }
  }

  if (mentionsWholeHome(normalizedMessage)) {
    return {
      candidates: sourceDevices,
      reason: "whole_home",
      unresolvedTerms: []
    };
  }

  return {
    candidates: [],
    reason: "none",
    unresolvedTerms: []
  };
}

function inferMetricFromMessage(message: string) {
  for (const alias of metricAliases) {
    if (alias.keywords.some((keyword) => message.includes(normalizeText(keyword)))) {
      return alias.metric;
    }
  }

  return null;
}

function metricLabelsForPrompt(metric: string) {
  const alias = metricAliases.find((item) => item.metric === metric);
  return alias?.keywords[0] ?? metric;
}

function deviceSupportsMetric(device: HomiDeviceContext, metric: string) {
  const supportedMetrics = seriesDefaultMetrics[device.series] ?? [];
  if (supportedMetrics.length > 0) {
    return supportedMetrics.includes(metric);
  }

  return Object.prototype.hasOwnProperty.call(device.latestMetrics, metric);
}

function seriesSupportsMetric(device: HomiDeviceContext, metric: string) {
  return (seriesDefaultMetrics[device.series] ?? []).includes(metric);
}

function firstSeriesMetric(series: string) {
  return seriesDefaultMetrics[series]?.[0] ?? null;
}

function getDeviceMetricOptions(device: HomiDeviceContext) {
  const supportedMetrics = seriesDefaultMetrics[device.series] ?? [];
  if (supportedMetrics.length > 0) {
    return supportedMetrics;
  }

  return Object.keys(device.latestMetrics).filter((key) => publicMetricKeys.has(key));
}

function buildDeviceClarificationQuestion(resolution: DeviceResolution, noun: string) {
  if (resolution.reason === "ambiguous_location_alias" && resolution.unresolvedTerms.length > 0) {
    return `你目前沒有名為「${resolution.unresolvedTerms[0]}」的房屋或空間。請選擇要查看哪一台${noun}。`;
  }

  if (resolution.reason === "actual_location") {
    return `這個空間底下有多台${noun}，請選擇要查看哪一台。`;
  }

  if (resolution.reason === "series") {
    return `這個系列底下有多台${noun}，請選擇要查看哪一台。`;
  }

  if (resolution.reason === "metric_capability") {
    return `我找到多台支援這個欄位的${noun}，請選擇要查看哪一台。`;
  }

  return `請選擇要查看哪一台${noun}。`;
}

function dedupeDevices(devices: HomiDeviceContext[]) {
  const seen = new Set<string>();
  const unique: HomiDeviceContext[] = [];

  for (const device of devices) {
    if (seen.has(device.id)) {
      continue;
    }

    seen.add(device.id);
    unique.push(device);
  }

  return unique;
}

function deviceMatchesAliasTerm(device: HomiDeviceContext, term: string) {
  const normalizedTerm = normalizeText(term);
  const fields = [
    device.nickname,
    device.displayName,
    device.modelName,
    ...(seriesAliases[device.series] ?? [])
  ]
    .filter(Boolean)
    .map((field) => normalizeText(String(field)));

  return fields.some((field) => field.includes(normalizedTerm));
}

function inferExplicitSeries(message: string) {
  const explicitSeriesAliases: Record<string, string[]> = {
    k_series: ["k系列", "kseries"],
    m_series: ["m系列", "mseries", "main", "主機"],
    p_series: ["p系列", "pseries", "智慧插座", "插座"],
    r_series: ["r系列", "rseries"],
    t_series: ["t系列", "tseries"]
  };

  return Object.entries(explicitSeriesAliases).find(([, aliases]) =>
    aliases.some((alias) => message.includes(normalizeText(alias)))
  )?.[0] ?? null;
}

function firstMetric(latestMetrics: Record<string, unknown>) {
  return Object.keys(latestMetrics).find((key) => publicMetricKeys.has(key))
    ?? Object.keys(latestMetrics)[0]
    ?? null;
}

function inferRange(message: string): { rangeMode: DataRangeMode; customFrom?: string; customTo?: string } {
  const customRange = inferCustomRange(message);
  if (customRange) {
    return customRange;
  }

  if (message.includes("7天") || message.includes("七天") || message.includes("一週") || message.includes("一周")) {
    return { rangeMode: "7d" };
  }

  return { rangeMode: "24h" };
}

function inferCustomRange(message: string): { rangeMode: DataRangeMode; customFrom: string; customTo: string } | null {
  const matches = Array.from(message.matchAll(/(\d{1,2})\s*(?:月|\/)\s*(\d{1,2})\s*(?:日)?/g));
  if (matches.length < 2) {
    return null;
  }

  const year = new Date().getFullYear();
  const first = matches[0];
  const second = matches[1];
  const from = new Date(year, Number(first[1]) - 1, Number(first[2]), 0, 0, 0, 0);
  const to = new Date(year, Number(second[1]) - 1, Number(second[2]), 23, 59, 59, 999);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  return {
    rangeMode: "custom",
    customFrom: from.toISOString(),
    customTo: to.toISOString()
  };
}

function rangeBounds(range: { rangeMode: DataRangeMode; customFrom?: string; customTo?: string }) {
  if (range.rangeMode === "custom") {
    return {
      from: range.customFrom,
      to: range.customTo
    };
  }

  const now = new Date();
  const offsetMs = range.rangeMode === "7d" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return {
    from: new Date(now.getTime() - offsetMs).toISOString(),
    to: now.toISOString()
  };
}

function isStatusOverviewIntent(message: string) {
  return (
    message.includes("狀態") &&
    (
      message.includes("家裡") ||
      message.includes("今天") ||
      message.includes("今日") ||
      message.includes("目前") ||
      message.includes("整體") ||
      message.includes("總覽")
    )
  );
}

function isLocationStatusIntent(message: string) {
  return (
    (
      ["目前", "現在", "環境", "狀態", "如何", "怎麼樣", "怎樣", "還好嗎"].some((keyword) =>
        message.includes(keyword)
      ) ||
      ["哪些裝置", "有什麼裝置", "有那些裝置", "有幾台裝置"].some((keyword) => message.includes(keyword))
    ) &&
    !mentionsLongTermDataIntent(message) &&
    !["新增", "建立", "修改", "設定", "管理", "綁定", "移動", "放到"].some((keyword) =>
      message.includes(keyword)
    )
  );
}

function isRelayIntent(message: string) {
  return (
    (message.includes("插座") || message.includes("relay") || message.includes("p系列") || message.includes("p 系列")) &&
    (message.includes("打開") ||
      message.includes("開啟") ||
      message.includes("關閉") ||
      message.includes("關掉") ||
      message.includes("打掉") ||
      message.includes("開") ||
      message.includes("關"))
  );
}

function isDataIntent(message: string) {
  return [
    "數據",
    "資料",
    "查",
    "看",
    "趨勢",
    "歷史",
    "平均",
    "最高",
    "最低",
    "有沒有"
  ].some((keyword) => message.includes(keyword));
}

function isNavigationIntent(message: string) {
  return ["首頁", "裝置頁", "數據頁", "資料頁", "個人", "帳號", "房屋", "空間"].some((keyword) =>
    message.includes(keyword)
  );
}

function mentionsTutorialIntent(message: string) {
  return [
    "如何",
    "怎麼",
    "怎樣",
    "怎麼用",
    "教我",
    "在哪",
    "哪裡",
    "我要如何",
    "要如何",
    "使用教學",
    "教學"
  ].some((keyword) => message.includes(keyword));
}

function mentionsProductClaimIntent(message: string) {
  return mentionsProductClaimTopic(message) && (message.includes("新增") || message.includes("綁定") || message.includes("加入"));
}

function mentionsProductClaimTopic(message: string) {
  return (
    message.includes("產品") ||
    message.includes("產品編號") ||
    message.includes("新增裝置") ||
    message.includes("綁定裝置") ||
    message.includes("新增設備") ||
    message.includes("綁定設備")
  );
}

function mentionsProfileTopic(message: string) {
  return (
    message.includes("個人資料") ||
    message.includes("帳號") ||
    message.includes("email") ||
    message.includes("電子郵件") ||
    message.includes("顯示名稱") ||
    message.includes("密碼") ||
    message.includes("註銷")
  );
}

function mentionsHouseSpaceTopic(message: string) {
  return (
    message.includes("房屋") ||
    message.includes("空間") ||
    message.includes("房間") ||
    message.includes("客廳") ||
    message.includes("廚房")
  ) && (
    message.includes("新增") ||
    message.includes("建立") ||
    message.includes("管理") ||
    message.includes("設定") ||
    mentionsTutorialIntent(message)
  );
}

function mentionsDataChartTopic(message: string) {
  return mentionsLongTermDataIntent(message) || message.includes("數據") || message.includes("圖表") || message.includes("歷史");
}

function mentionsLongTermDataIntent(message: string) {
  return [
    "長期",
    "歷史",
    "圖表",
    "趨勢",
    "7天",
    "七天",
    "24小時",
    "一週",
    "一周",
    "平均",
    "最高",
    "最低"
  ].some((keyword) => message.includes(keyword));
}

function mentionsRelayTopic(message: string) {
  return mentionsRelayTarget(message) || message.includes("開關") || message.includes("電源");
}

function mentionsPreferenceTopic(message: string) {
  return (
    message.includes("開發者模式") ||
    message.includes("顯示模式") ||
    message.includes("依系列") ||
    message.includes("依空間") ||
    message.includes("排序") ||
    message.includes("偏好")
  );
}

function inferProductCode(message: string) {
  const match = message.toUpperCase().match(/\b[A-Z]-DEMO-\d{4}\b|\b[A-Z0-9]{1,12}-[A-Z0-9-]{3,48}\b/);
  return match?.[0] ?? null;
}

function inferRoute(message: string): AgentRoute {
  if (message.includes("裝置")) {
    return "devices";
  }

  if (message.includes("數據") || message.includes("資料")) {
    return "data";
  }

  if (message.includes("帳號")) {
    return "account";
  }

  if (message.includes("房屋") || message.includes("空間")) {
    return "houses";
  }

  if (message.includes("個人")) {
    return "profile";
  }

  return "home";
}

function inferRelayState(message: string) {
  if (message.includes("關閉") || message.includes("關掉") || message.includes("關")) {
    return false;
  }

  if (message.includes("打開") || message.includes("開啟") || message.includes("開")) {
    return true;
  }

  return null;
}

function inferRelayStateFromInput(message: string, input: AgentMessageInput) {
  const directState = inferRelayState(message);
  if (directState !== null) {
    return directState;
  }

  const recentMessages = (input.messages ?? []).slice(-6).reverse();
  for (const recentMessage of recentMessages) {
    const text = normalizeText(recentMessage.text);

    if (recentMessage.role === "assistant") {
      if (
        (text.includes("想要開啟哪一個") || text.includes("要開啟哪一個")) &&
        !text.includes("還是關閉")
      ) {
        return true;
      }

      if (
        (text.includes("想要關閉哪一個") || text.includes("要關閉哪一個")) &&
        !text.includes("還是開啟")
      ) {
        return false;
      }
    }

    if (recentMessage.role === "user" && isRelayIntent(text)) {
      const state = inferRelayState(text);
      if (state !== null) {
        return state;
      }
    }
  }

  return null;
}

function getKnownRelayState(device: HomiDeviceContext) {
  const relayValue = device.latestMetrics.relay_on;
  return typeof relayValue === "boolean" ? relayValue : null;
}

function mentionsWholeHome(message: string) {
  return message.includes("家裡") || message.includes("全部") || message.includes("所有");
}

function askPlan(
  question: string,
  options?: Array<{ label: string; value: string }>,
  source: AgentPlan["source"] = "fallback"
): AgentPlan {
  return {
    assistantMessage: question,
    actions: [
      createAction({
        type: "ask_clarification",
        question,
        options,
        description: "需要使用者補充資訊",
        cursorHints: [{ target: "center", gesture: "move" }],
        requiresConfirmation: false
      })
    ],
    source,
    warnings: []
  };
}

function isAllowedMetric(context: HomiContext, metric: string) {
  return /^[a-zA-Z0-9_.-]{1,64}$/.test(metric) && (context.metrics.includes(metric) || publicMetricKeys.has(metric));
}

function getContextDevice(context: HomiContext, deviceId: unknown) {
  return typeof deviceId === "string"
    ? context.devices.find((device) => device.id === deviceId) ?? null
    : null;
}

function getContextHouse(context: HomiContext, houseId: unknown) {
  return typeof houseId === "string"
    ? context.houses.find((house) => house.id === houseId) ?? null
    : null;
}

function getHouseSpace(
  house: Awaited<ReturnType<typeof listUserHouses>>[number],
  spaceId: unknown
) {
  return typeof spaceId === "string"
    ? house.spaces.find((space) => space.id === spaceId) ?? null
    : null;
}

function normalizeHouseSpaceInput(
  context: HomiContext,
  rawHouseId: unknown,
  rawSpaceId: unknown
): { houseId?: string | null; spaceId?: string | null; invalid?: string } {
  if (rawHouseId === undefined && rawSpaceId === undefined) {
    return {};
  }

  if (rawHouseId === null) {
    return {
      houseId: null,
      spaceId: null
    };
  }

  let house = typeof rawHouseId === "string" ? getContextHouse(context, rawHouseId) : null;

  if (!house && rawHouseId !== undefined) {
    return { invalid: "houseId does not belong to the current user" };
  }

  if (rawSpaceId === null) {
    return {
      houseId: house?.id ?? null,
      spaceId: null
    };
  }

  if (typeof rawSpaceId === "string") {
    if (!house) {
      house = context.houses.find((candidate) =>
        candidate.spaces.some((space) => space.id === rawSpaceId)
      ) ?? null;
    }

    const space = house?.spaces.find((candidate) => candidate.id === rawSpaceId) ?? null;
    if (!house || !space) {
      return { invalid: "spaceId does not belong to the chosen house" };
    }

    return {
      houseId: house.id,
      spaceId: space.id
    };
  }

  return {
    houseId: house?.id,
    spaceId: undefined
  };
}

function normalizeRequiredName(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized.length > 0 ? normalized : null;
}

function normalizeNullableName(value: unknown, maxLength: number) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  return normalizeRequiredName(value, maxLength);
}

function normalizeProductCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const productCode = value.trim().toUpperCase();
  return /^[A-Z0-9-]{3,64}$/.test(productCode) ? productCode : null;
}

function parseOptionalDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function formatDeviceOption(device: HomiDeviceContext) {
  const location = [device.house, device.space].filter(Boolean).join(" · ");
  return location ? `${device.nickname} (${location})` : device.nickname;
}

function round1(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function buildThreadMemory(threadId: string, userId: string): Promise<ThreadMemory> {
  const [threadResult, messageResult] = await Promise.all([
    pool.query<{ context_summary: string | null }>(
      `
        SELECT context_summary
        FROM app_agent_threads
        WHERE id = $1
          AND user_id = $2;
      `,
      [threadId, userId]
    ),
    pool.query<{ role: "assistant" | "user"; content: string }>(
      `
        SELECT role, content
        FROM app_agent_messages
        WHERE thread_id = $1
          AND user_id = $2
          AND role IN ('user', 'assistant')
        ORDER BY created_at DESC
        LIMIT 10;
      `,
      [threadId, userId]
    )
  ]);

  return {
    summary: threadResult.rows[0]?.context_summary ?? null,
    recentMessages: messageResult.rows.reverse().map((message) => ({
      role: message.role,
      text: message.content
    }))
  };
}

async function maybeCompactThread(threadId: string, userId: string) {
  const threadResult = await pool.query<{
    context_summary: string | null;
    context_summary_message_count: number;
  }>(
    `
      SELECT context_summary, context_summary_message_count
      FROM app_agent_threads
      WHERE id = $1
        AND user_id = $2;
    `,
    [threadId, userId]
  );
  const thread = threadResult.rows[0];

  if (!thread) {
    return;
  }

  const messageResult = await pool.query<{
    role: "assistant" | "user" | "system";
    content: string;
    created_at: string;
  }>(
    `
      SELECT role, content, created_at::text
      FROM app_agent_messages
      WHERE thread_id = $1
        AND user_id = $2
        AND role IN ('user', 'assistant')
      ORDER BY created_at ASC;
    `,
    [threadId, userId]
  );
  const messages = messageResult.rows;

  if (messages.length <= 20) {
    return;
  }

  const keepRecentCount = 10;
  const compactableMessages = messages.slice(0, Math.max(0, messages.length - keepRecentCount));
  const compactedCount = Number(thread.context_summary_message_count) || 0;

  if (compactableMessages.length <= compactedCount + 4) {
    return;
  }

  const nextMessages = compactableMessages.slice(compactedCount);
  const contextSummary = compactConversationSummary(thread.context_summary, nextMessages);

  await pool.query(
    `
      UPDATE app_agent_threads
      SET context_summary = $3,
          context_summary_message_count = $4,
          context_summary_updated_at = now(),
          updated_at = now()
      WHERE id = $1
        AND user_id = $2;
    `,
    [threadId, userId, contextSummary, compactableMessages.length]
  );
}

function compactConversationSummary(
  existingSummary: string | null,
  messages: Array<{ role: "assistant" | "user" | "system"; content: string; created_at: string }>
) {
  const existing = existingSummary?.trim()
    ? `既有摘要：\n${existingSummary.trim()}`
    : "既有摘要：無";
  const nextLines = messages.map((message) => {
    const roleLabel = message.role === "user" ? "使用者" : "Homi";
    return `${roleLabel}: ${oneLine(message.content).slice(0, 220)}`;
  });
  const summary = [
    existing,
    "新增壓縮對話：",
    ...nextLines
  ].join("\n");
  const maxLength = 3600;

  return summary.length > maxLength ? summary.slice(summary.length - maxLength) : summary;
}

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function getOrCreateThread(userId: string, inputThreadId: string | undefined, message: string) {
  const bounds = currentMonthBounds();

  if (inputThreadId) {
    const result = await pool.query<{ id: string }>(
      `
        SELECT id::text
        FROM app_agent_threads
        WHERE id = $1
          AND user_id = $2
          AND created_at >= $3::timestamptz
          AND created_at < $4::timestamptz;
      `,
      [inputThreadId, userId, bounds.from, bounds.to]
    );

    if (result.rows[0]) {
      await pool.query("UPDATE app_agent_threads SET updated_at = now() WHERE id = $1;", [inputThreadId]);
      return result.rows[0].id;
    }
  }

  const currentMonthThreadResult = await pool.query<{ id: string }>(
    `
      SELECT id::text
      FROM app_agent_threads
      WHERE user_id = $1
        AND created_at >= $2::timestamptz
        AND created_at < $3::timestamptz
      ORDER BY updated_at DESC
      LIMIT 1;
    `,
    [userId, bounds.from, bounds.to]
  );

  if (currentMonthThreadResult.rows[0]) {
    const threadId = currentMonthThreadResult.rows[0].id;
    await pool.query("UPDATE app_agent_threads SET updated_at = now() WHERE id = $1;", [threadId]);
    return threadId;
  }

  const threadId = randomUUID();
  const title = message.trim().slice(0, 80) || "Homi 對話";
  await pool.query(
    `
      INSERT INTO app_agent_threads (id, user_id, title)
      VALUES ($1, $2, $3);
    `,
    [threadId, userId, title]
  );
  return threadId;
}

function currentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const month = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    month
  };
}

async function pruneAgentHistoryBeforeCurrentMonth(userId: string) {
  const bounds = currentMonthBounds();
  await pool.query(
    `
      DELETE FROM app_agent_threads
      WHERE user_id = $1
        AND created_at < $2::timestamptz;
    `,
    [userId, bounds.from]
  );
}

async function storeAgentMessage(input: {
  threadId: string;
  userId: string;
  role: "assistant" | "user" | "system";
  content: string;
  actions: HomiAction[];
  clientState: AgentClientState;
  model: string | null;
}) {
  await pool.query(
    `
      INSERT INTO app_agent_messages (
        id,
        thread_id,
        user_id,
        role,
        content,
        actions,
        client_state,
        model
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8);
    `,
    [
      randomUUID(),
      input.threadId,
      input.userId,
      input.role,
      input.content,
      JSON.stringify(input.actions),
      JSON.stringify(input.clientState),
      input.model
    ]
  );

  await pool.query("UPDATE app_agent_threads SET updated_at = now() WHERE id = $1;", [input.threadId]);
}

async function storeActionRuns(threadId: string, userId: string, actions: HomiAction[]) {
  for (const action of actions) {
    await pool.query(
      `
        INSERT INTO app_agent_action_runs (
          id,
          thread_id,
          user_id,
          action_id,
          action_type,
          action,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7);
      `,
      [
        randomUUID(),
        threadId,
        userId,
        action.id,
        action.type,
        JSON.stringify(action),
        action.requiresConfirmation ? "pending_confirmation" : "queued"
      ]
    );
  }
}
