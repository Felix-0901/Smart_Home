import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { createBaseSchema, ensureSeriesTable } from "../db/schema.js";
import type { DeviceDto } from "./app-devices.js";
import { listUserDevices } from "./app-devices.js";
import {
  buildInviteReadingValues,
  isInviteDemoCapabilities,
  seriesCodeForInvite,
  type InviteSeriesKey
} from "./invite-simulator.js";
import { getLatestDeviceReading, insertSeriesReading } from "./readings.js";

const inviteLockId = 17487620260606;
const inviteDevicesPerSeries = 2;
const inviteHouseName = "展示屋";

type InviteDevicePlan = {
  seriesKey: InviteSeriesKey;
  displayName: string;
  modelName: string;
  seriesDisplayName: string;
  aliases: [string, string];
  spaces: [string, string];
  capabilities: Record<string, unknown>;
};

const inviteDevicePlans: InviteDevicePlan[] = [
  {
    seriesKey: "k_series",
    displayName: "K 系列邀請廚房感測站",
    modelName: "K Series Invite",
    seriesDisplayName: "K 系列",
    aliases: ["廚房感測站 1", "廚房感測站 2"],
    spaces: ["廚房", "廚房"],
    capabilities: {
      flameDetection: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  },
  {
    seriesKey: "m_series",
    displayName: "M 系列邀請主控環境站",
    modelName: "M Series Invite",
    seriesDisplayName: "M 系列",
    aliases: ["家庭主控站 1", "家庭主控站 2"],
    spaces: ["客廳", "客廳"],
    capabilities: {
      mainPanel: true,
      oledDisplay: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  },
  {
    seriesKey: "p_series",
    displayName: "P 系列邀請智慧插座",
    modelName: "P Series Invite",
    seriesDisplayName: "P 系列",
    aliases: ["客廳智慧插座", "房間智慧插座"],
    spaces: ["客廳", "房間"],
    capabilities: {
      smartPlug: true,
      mqtt: false,
      relayControl: true,
      availability: true,
      telemetry: true
    }
  },
  {
    seriesKey: "r_series",
    displayName: "R 系列邀請房間感測器",
    modelName: "R Series Invite",
    seriesDisplayName: "R 系列",
    aliases: ["房間感測器", "書房感測器"],
    spaces: ["房間", "書房"],
    capabilities: {
      compactSensor: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  },
  {
    seriesKey: "t_series",
    displayName: "T 系列邀請人體存在感測器",
    modelName: "T Series Invite",
    seriesDisplayName: "T 系列",
    aliases: ["浴室人體感測器", "房間人體感測器"],
    spaces: ["浴室", "房間"],
    capabilities: {
      presenceDetection: true,
      airQuality: true,
      temperatureHumidity: true,
      gasAnalog: true,
      rgbStatusLed: true,
      relayControl: false
    }
  }
];

export class InviteCodeError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export async function redeemInviteCode(userId: string, rawInviteCode: string) {
  const inviteCode = config.APP_INVITE_CODE.trim();
  const normalizedInput = rawInviteCode.trim();

  if (normalizedInput.toLocaleLowerCase() !== inviteCode.toLocaleLowerCase()) {
    throw new InviteCodeError("邀請碼不正確", 400);
  }

  const client = await pool.connect();
  let alreadyRedeemed = false;

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await client.query("SELECT pg_advisory_xact_lock($1::bigint);", [inviteLockId]);

    const existingRedemption = await client.query<{ id: string }>(
      `
        SELECT id
        FROM app_invite_redemptions
        WHERE user_id = $1
          AND lower(invite_code) = lower($2)
        FOR UPDATE;
      `,
      [userId, inviteCode]
    );

    if (existingRedemption.rows[0]) {
      alreadyRedeemed = true;
    } else {
      const houseId = await ensureInviteHouse(client, userId);
      const spaceIds = await ensureInviteSpaces(client, houseId);
      let createdDeviceCount = 0;

      for (const plan of inviteDevicePlans) {
        await ensureSeriesTable(client, plan.seriesKey);
        await client.query(
          `
            INSERT INTO hardware_series (series_key, display_name)
            VALUES ($1, $2)
            ON CONFLICT (series_key) DO UPDATE
            SET display_name = EXCLUDED.display_name,
                updated_at = now();
          `,
          [plan.seriesKey, plan.seriesDisplayName]
        );

        const startSuffix = await nextInviteSuffix(client, plan.seriesKey);

        for (let index = 0; index < inviteDevicesPerSeries; index += 1) {
          const suffix = startSuffix + index;
          const suffixText = formatInviteSuffix(suffix);
          const seriesCode = seriesCodeForInvite(plan.seriesKey);
          const deviceUuid = randomUUID();
          const productCode = `${seriesCode}-INVITE-${suffixText}`;
          const deviceId = `${seriesCode.toLowerCase()}-invite-${suffixText}`;
          const spaceName = plan.spaces[index] ?? plan.spaces[0];
          const alias = plan.aliases[index] ?? `${seriesCode} 系列展示裝置 ${suffixText}`;
          const capabilities = {
            ...plan.capabilities,
            inviteDemo: true,
            virtualDevice: true,
            virtualReadings: true,
            inviteCode
          };

          await client.query(
            `
              INSERT INTO devices (
                id,
                product_code,
                series_key,
                device_id,
                display_name,
                model_name,
                capabilities,
                manufactured_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, now());
            `,
            [
              deviceUuid,
              productCode,
              plan.seriesKey,
              deviceId,
              `${plan.displayName} ${suffixText}`,
              plan.modelName,
              capabilities
            ]
          );

          await client.query(
            `
              INSERT INTO user_devices (
                id,
                user_id,
                device_id,
                alias,
                house_id,
                space_id
              )
              VALUES ($1, $2, $3, $4, $5, $6);
            `,
            [
              randomUUID(),
              userId,
              deviceUuid,
              alias,
              houseId,
              spaceIds.get(spaceName) ?? null
            ]
          );

          createdDeviceCount += 1;
        }
      }

      await client.query(
        `
          INSERT INTO app_invite_redemptions (id, user_id, invite_code, device_count)
          VALUES ($1, $2, $3, $4);
        `,
        [randomUUID(), userId, inviteCode, createdDeviceCount]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const devices = await listUserDevices(userId);
  const inviteDevices = devices.filter((device) => device.productCode.includes("-INVITE-"));

  return {
    inviteCode,
    alreadyRedeemed,
    deviceCount: inviteDevices.length,
    devices: inviteDevices
  };
}

export async function recordInviteRelayState(device: DeviceDto, relayOn: boolean) {
  if (device.seriesKey !== "p_series" || !isInviteDemoCapabilities(device.capabilities)) {
    throw new InviteCodeError("這個裝置不是邀請碼虛擬智慧插座", 400);
  }

  const latest = await getLatestDeviceReading(device.seriesKey, device.deviceId);
  const latestValues = latest?.values && typeof latest.values === "object"
    ? latest.values as Record<string, unknown>
    : {};
  const previousEnergyWh = typeof latestValues.energy_wh === "number" ? latestValues.energy_wh : undefined;
  const now = new Date();
  const values = buildInviteReadingValues("p_series", now, {
    deviceOrdinal: inviteDeviceOrdinal(device.productCode),
    relayOn,
    previousEnergyWh
  });

  await insertSeriesReading("p_series", values, {
    kind: "invite_virtual_relay",
    series_key: "p_series",
    device_id: device.deviceId,
    product_code: device.productCode,
    source: "invite_simulator",
    issued_at: now.toISOString()
  });

  return {
    deviceId: device.deviceId,
    virtual: true,
    command: {
      command_id: `invite-${Date.now()}-${randomUUID().slice(0, 8)}`,
      relay_on: relayOn,
      issued_at: now.toISOString(),
      source: "invite_simulator"
    }
  };
}

async function ensureInviteHouse(client: PoolClient, userId: string) {
  const existingHouse = await client.query<{ id: string }>(
    `
      SELECT id::text
      FROM app_houses
      WHERE user_id = $1
        AND name = $2
      ORDER BY created_at ASC
      LIMIT 1;
    `,
    [userId, inviteHouseName]
  );

  if (existingHouse.rows[0]) {
    return existingHouse.rows[0].id;
  }

  const houseId = randomUUID();
  await client.query(
    `
      INSERT INTO app_houses (id, user_id, name)
      VALUES ($1, $2, $3);
    `,
    [houseId, userId, inviteHouseName]
  );
  return houseId;
}

async function ensureInviteSpaces(client: PoolClient, houseId: string) {
  const names = Array.from(new Set(inviteDevicePlans.flatMap((plan) => plan.spaces)));
  const spaces = new Map<string, string>();

  for (const name of names) {
    const existingSpace = await client.query<{ id: string }>(
      `
        SELECT id::text
        FROM app_house_spaces
        WHERE house_id = $1
          AND name = $2
        ORDER BY created_at ASC
        LIMIT 1;
      `,
      [houseId, name]
    );

    if (existingSpace.rows[0]) {
      spaces.set(name, existingSpace.rows[0].id);
      continue;
    }

    const spaceId = randomUUID();
    await client.query(
      `
        INSERT INTO app_house_spaces (id, house_id, name)
        VALUES ($1, $2, $3);
      `,
      [spaceId, houseId, name]
    );
    spaces.set(name, spaceId);
  }

  return spaces;
}

async function nextInviteSuffix(client: PoolClient, seriesKey: InviteSeriesKey) {
  const seriesCode = seriesCodeForInvite(seriesKey);
  const result = await client.query<{ max_suffix: string | null }>(
    `
      SELECT MAX(substring(product_code from '[0-9]+$')::integer)::text AS max_suffix
      FROM devices
      WHERE product_code ~ $1;
    `,
    [`^${seriesCode}-INVITE-[0-9]+$`]
  );
  const currentMax = Number.parseInt(result.rows[0]?.max_suffix ?? "0", 10);
  return Number.isFinite(currentMax) ? currentMax + 1 : 1;
}

function formatInviteSuffix(value: number) {
  return String(value).padStart(4, "0");
}

function inviteDeviceOrdinal(productCode: string) {
  const match = productCode.match(/(\d+)$/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}
