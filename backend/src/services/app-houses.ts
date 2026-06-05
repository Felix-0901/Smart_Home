import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { createBaseSchema } from "../db/schema.js";

export type HouseSpaceDto = {
  id: string;
  houseId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type HouseDto = {
  id: string;
  name: string;
  spaces: HouseSpaceDto[];
  createdAt: string;
  updatedAt: string;
};

type HouseSpaceRow = {
  house_id: string;
  house_name: string;
  house_created_at: string;
  house_updated_at: string;
  space_id: string | null;
  space_name: string | null;
  space_created_at: string | null;
  space_updated_at: string | null;
};

type SpaceRow = {
  id: string;
  house_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export class HouseError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
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

function buildHouses(rows: HouseSpaceRow[]) {
  const houses = new Map<string, HouseDto>();

  for (const row of rows) {
    let house = houses.get(row.house_id);

    if (!house) {
      house = {
        id: row.house_id,
        name: row.house_name,
        spaces: [],
        createdAt: row.house_created_at,
        updatedAt: row.house_updated_at
      };
      houses.set(row.house_id, house);
    }

    if (row.space_id && row.space_name && row.space_created_at && row.space_updated_at) {
      house.spaces.push({
        id: row.space_id,
        houseId: row.house_id,
        name: row.space_name,
        createdAt: row.space_created_at,
        updatedAt: row.space_updated_at
      });
    }
  }

  return Array.from(houses.values());
}

export async function listUserHouses(userId: string) {
  await ensureAppSchema();

  const result = await pool.query<HouseSpaceRow>(
    `
      SELECT
        app_houses.id::text AS house_id,
        app_houses.name AS house_name,
        app_houses.created_at::text AS house_created_at,
        app_houses.updated_at::text AS house_updated_at,
        app_house_spaces.id::text AS space_id,
        app_house_spaces.name AS space_name,
        app_house_spaces.created_at::text AS space_created_at,
        app_house_spaces.updated_at::text AS space_updated_at
      FROM app_houses
      LEFT JOIN app_house_spaces
        ON app_house_spaces.house_id = app_houses.id
      WHERE app_houses.user_id = $1
      ORDER BY app_houses.created_at ASC, app_house_spaces.created_at ASC;
    `,
    [userId]
  );

  return buildHouses(result.rows);
}

export async function getUserHouse(userId: string, houseId: string) {
  await ensureAppSchema();

  const result = await pool.query<HouseSpaceRow>(
    `
      SELECT
        app_houses.id::text AS house_id,
        app_houses.name AS house_name,
        app_houses.created_at::text AS house_created_at,
        app_houses.updated_at::text AS house_updated_at,
        app_house_spaces.id::text AS space_id,
        app_house_spaces.name AS space_name,
        app_house_spaces.created_at::text AS space_created_at,
        app_house_spaces.updated_at::text AS space_updated_at
      FROM app_houses
      LEFT JOIN app_house_spaces
        ON app_house_spaces.house_id = app_houses.id
      WHERE app_houses.user_id = $1
        AND app_houses.id = $2
      ORDER BY app_house_spaces.created_at ASC;
    `,
    [userId, houseId]
  );

  return buildHouses(result.rows)[0] ?? null;
}

export async function createHouse(userId: string, name: string) {
  await ensureAppSchema();

  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO app_houses (id, user_id, name)
      VALUES ($1, $2, $3)
      RETURNING id::text;
    `,
    [randomUUID(), userId, name.trim()]
  );

  const house = await getUserHouse(userId, result.rows[0].id);
  if (!house) {
    throw new HouseError("房屋建立失敗", 500);
  }

  return house;
}

export async function updateHouse(userId: string, houseId: string, name: string) {
  await ensureAppSchema();

  await pool.query(
    `
      UPDATE app_houses
      SET name = $3, updated_at = now()
      WHERE user_id = $1
        AND id = $2;
    `,
    [userId, houseId, name.trim()]
  );

  return getUserHouse(userId, houseId);
}

export async function deleteHouse(userId: string, houseId: string) {
  await ensureAppSchema();

  await pool.query(
    `
      UPDATE user_devices
      SET house_id = NULL,
          space_id = NULL,
          room_name = NULL,
          updated_at = now()
      WHERE user_id = $1
        AND house_id = $2;
    `,
    [userId, houseId]
  );

  const result = await pool.query(
    `
      DELETE FROM app_houses
      WHERE user_id = $1
        AND id = $2;
    `,
    [userId, houseId]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function createHouseSpace(userId: string, houseId: string, name: string) {
  await ensureAppSchema();

  const houseResult = await pool.query<{ id: string }>(
    "SELECT id::text FROM app_houses WHERE user_id = $1 AND id = $2;",
    [userId, houseId]
  );

  if (!houseResult.rows[0]) {
    throw new HouseError("找不到房屋", 404);
  }

  const result = await pool.query<SpaceRow>(
    `
      INSERT INTO app_house_spaces (id, house_id, name)
      VALUES ($1, $2, $3)
      RETURNING id::text, house_id::text, name, created_at::text, updated_at::text;
    `,
    [randomUUID(), houseId, name.trim()]
  );

  return toSpaceDto(result.rows[0]);
}

export async function updateHouseSpace(
  userId: string,
  houseId: string,
  spaceId: string,
  name: string
) {
  await ensureAppSchema();

  const result = await pool.query<SpaceRow>(
    `
      UPDATE app_house_spaces
      SET name = $4, updated_at = now()
      FROM app_houses
      WHERE app_house_spaces.house_id = app_houses.id
        AND app_houses.user_id = $1
        AND app_houses.id = $2
        AND app_house_spaces.id = $3
      RETURNING
        app_house_spaces.id::text,
        app_house_spaces.house_id::text,
        app_house_spaces.name,
        app_house_spaces.created_at::text,
        app_house_spaces.updated_at::text;
    `,
    [userId, houseId, spaceId, name.trim()]
  );

  return result.rows[0] ? toSpaceDto(result.rows[0]) : null;
}

export async function deleteHouseSpace(userId: string, houseId: string, spaceId: string) {
  await ensureAppSchema();

  await pool.query(
    `
      UPDATE user_devices
      SET space_id = NULL,
          room_name = NULL,
          updated_at = now()
      WHERE user_id = $1
        AND house_id = $2
        AND space_id = $3;
    `,
    [userId, houseId, spaceId]
  );

  const result = await pool.query(
    `
      DELETE FROM app_house_spaces
      USING app_houses
      WHERE app_house_spaces.house_id = app_houses.id
        AND app_houses.user_id = $1
        AND app_houses.id = $2
        AND app_house_spaces.id = $3;
    `,
    [userId, houseId, spaceId]
  );

  return (result.rowCount ?? 0) > 0;
}

function toSpaceDto(row: SpaceRow): HouseSpaceDto {
  return {
    id: row.id,
    houseId: row.house_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
