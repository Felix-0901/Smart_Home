import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { createBaseSchema } from "../db/schema.js";
import { getLatestDeviceReading } from "./readings.js";

export type DeviceDto = {
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
};

type DeviceRow = {
  id: string;
  product_code: string;
  series_key: string;
  device_id: string;
  display_name: string;
  model_name: string;
  capabilities: Record<string, unknown>;
  alias: string | null;
  room_name: string | null;
  house_id: string | null;
  house_name: string | null;
  space_id: string | null;
  space_name: string | null;
  claimed_at: string | null;
};

export class DeviceClaimError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export class DeviceUpdateError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

function toDeviceDto(row: DeviceRow): DeviceDto {
  return {
    id: row.id,
    productCode: row.product_code,
    seriesKey: row.series_key,
    deviceId: row.device_id,
    displayName: row.display_name,
    modelName: row.model_name,
    capabilities: row.capabilities,
    alias: row.alias,
    roomName: row.room_name,
    houseId: row.house_id,
    houseName: row.house_name,
    spaceId: row.space_id,
    spaceName: row.space_name,
    claimedAt: row.claimed_at
  };
}

async function ensureAppSchema() {
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

export async function listUserDevices(userId: string) {
  await ensureAppSchema();

  const result = await pool.query<DeviceRow>(
    `
      SELECT
        devices.id,
        devices.product_code,
        devices.series_key,
        devices.device_id,
        devices.display_name,
        devices.model_name,
        devices.capabilities,
        user_devices.alias,
        COALESCE(app_house_spaces.name, user_devices.room_name) AS room_name,
        app_houses.id::text AS house_id,
        app_houses.name AS house_name,
        app_house_spaces.id::text AS space_id,
        app_house_spaces.name AS space_name,
        user_devices.claimed_at::text
      FROM user_devices
      JOIN devices ON devices.id = user_devices.device_id
      LEFT JOIN app_houses
        ON app_houses.id = user_devices.house_id
        AND app_houses.user_id = user_devices.user_id
      LEFT JOIN app_house_spaces
        ON app_house_spaces.id = user_devices.space_id
        AND app_house_spaces.house_id = app_houses.id
      WHERE user_devices.user_id = $1
      ORDER BY user_devices.claimed_at DESC;
    `,
    [userId]
  );

  return Promise.all(
    result.rows.map(async (row) => {
      const device = toDeviceDto(row);
      const latestReading = await getLatestDeviceReading(device.seriesKey, device.deviceId);
      return { ...device, latestReading };
    })
  );
}

export async function claimDevice(userId: string, productCode: string) {
  const client = await pool.connect();
  const normalizedProductCode = productCode.trim().toUpperCase();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);

    const deviceResult = await client.query<DeviceRow>(
      `
        SELECT
          devices.id,
          devices.product_code,
          devices.series_key,
          devices.device_id,
          devices.display_name,
          devices.model_name,
          devices.capabilities,
          NULL::text AS alias,
          NULL::text AS room_name,
          NULL::text AS house_id,
          NULL::text AS house_name,
          NULL::text AS space_id,
          NULL::text AS space_name,
          NULL::text AS claimed_at
        FROM devices
        WHERE devices.product_code = $1
        FOR UPDATE;
      `,
      [normalizedProductCode]
    );

    const device = deviceResult.rows[0];
    if (!device) {
      throw new DeviceClaimError("找不到這個產品編號", 404);
    }

    const ownerResult = await client.query<{ user_id: string }>(
      "SELECT user_id FROM user_devices WHERE device_id = $1 FOR UPDATE;",
      [device.id]
    );
    const owner = ownerResult.rows[0];

    if (owner && owner.user_id !== userId) {
      throw new DeviceClaimError("這個產品已經被其他帳號綁定", 409);
    }

    await client.query(
      `
        INSERT INTO user_devices (id, user_id, device_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, device_id) DO NOTHING;
      `,
      [randomUUID(), userId, device.id]
    );

    await client.query("COMMIT");

    const userDevice = await getUserDevice(userId, device.id);
    if (!userDevice) {
      throw new DeviceClaimError("裝置綁定失敗", 500);
    }

    return userDevice;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getUserDevice(userId: string, deviceUuid: string) {
  await ensureAppSchema();

  const result = await pool.query<DeviceRow>(
    `
      SELECT
        devices.id,
        devices.product_code,
        devices.series_key,
        devices.device_id,
        devices.display_name,
        devices.model_name,
        devices.capabilities,
        user_devices.alias,
        COALESCE(app_house_spaces.name, user_devices.room_name) AS room_name,
        app_houses.id::text AS house_id,
        app_houses.name AS house_name,
        app_house_spaces.id::text AS space_id,
        app_house_spaces.name AS space_name,
        user_devices.claimed_at::text
      FROM user_devices
      JOIN devices ON devices.id = user_devices.device_id
      LEFT JOIN app_houses
        ON app_houses.id = user_devices.house_id
        AND app_houses.user_id = user_devices.user_id
      LEFT JOIN app_house_spaces
        ON app_house_spaces.id = user_devices.space_id
        AND app_house_spaces.house_id = app_houses.id
      WHERE user_devices.user_id = $1
        AND devices.id = $2;
    `,
    [userId, deviceUuid]
  );

  return result.rows[0] ? toDeviceDto(result.rows[0]) : null;
}

export async function updateUserDevice(
  userId: string,
  deviceUuid: string,
  input: {
    alias?: string | null;
    roomName?: string | null;
    houseId?: string | null;
    spaceId?: string | null;
  }
) {
  await ensureAppSchema();
  const hasAlias = Object.prototype.hasOwnProperty.call(input, "alias");
  let hasRoomName = Object.prototype.hasOwnProperty.call(input, "roomName");
  let hasHouseId = Object.prototype.hasOwnProperty.call(input, "houseId");
  let hasSpaceId = Object.prototype.hasOwnProperty.call(input, "spaceId");
  let nextRoomName = input.roomName ?? null;
  let nextHouseId = input.houseId ?? null;
  let nextSpaceId = input.spaceId ?? null;

  if (hasSpaceId && input.spaceId) {
    const space = await getOwnedSpace(userId, input.spaceId);

    if (!space) {
      throw new DeviceUpdateError("找不到空間", 404);
    }

    if (input.houseId && input.houseId !== space.house_id) {
      throw new DeviceUpdateError("空間不屬於選擇的房屋", 400);
    }

    hasHouseId = true;
    hasRoomName = true;
    nextHouseId = space.house_id;
    nextSpaceId = space.id;
    nextRoomName = null;
  } else if (hasHouseId && input.houseId) {
    const house = await getOwnedHouse(userId, input.houseId);

    if (!house) {
      throw new DeviceUpdateError("找不到房屋", 404);
    }
  }

  if (hasHouseId && input.houseId === null) {
    hasSpaceId = true;
    hasRoomName = true;
    nextHouseId = null;
    nextSpaceId = null;
    nextRoomName = null;
  } else if (hasSpaceId && input.spaceId === null) {
    hasRoomName = true;
    nextSpaceId = null;
    nextRoomName = null;
  }

  await pool.query(
    `
      UPDATE user_devices
      SET
        alias = CASE WHEN $3::boolean THEN $4 ELSE alias END,
        room_name = CASE WHEN $5::boolean THEN $6 ELSE room_name END,
        house_id = CASE WHEN $7::boolean THEN $8 ELSE house_id END,
        space_id = CASE WHEN $9::boolean THEN $10 ELSE space_id END,
        updated_at = now()
      WHERE user_id = $1
        AND device_id = $2;
    `,
    [
      userId,
      deviceUuid,
      hasAlias,
      input.alias ?? null,
      hasRoomName,
      nextRoomName,
      hasHouseId,
      nextHouseId,
      hasSpaceId,
      nextSpaceId
    ]
  );

  return getUserDevice(userId, deviceUuid);
}

export async function deleteUserDevice(userId: string, deviceUuid: string) {
  await ensureAppSchema();

  const result = await pool.query(
    `
      DELETE FROM user_devices
      WHERE user_id = $1
        AND device_id = $2;
    `,
    [userId, deviceUuid]
  );

  return (result.rowCount ?? 0) > 0;
}

async function getOwnedHouse(userId: string, houseId: string) {
  const result = await pool.query<{ id: string }>(
    "SELECT id::text FROM app_houses WHERE user_id = $1 AND id = $2;",
    [userId, houseId]
  );

  return result.rows[0] ?? null;
}

async function getOwnedSpace(userId: string, spaceId: string) {
  const result = await pool.query<{ id: string; house_id: string; name: string }>(
    `
      SELECT
        app_house_spaces.id::text,
        app_house_spaces.house_id::text,
        app_house_spaces.name
      FROM app_house_spaces
      JOIN app_houses
        ON app_houses.id = app_house_spaces.house_id
      WHERE app_houses.user_id = $1
        AND app_house_spaces.id = $2;
    `,
    [userId, spaceId]
  );

  return result.rows[0] ?? null;
}
