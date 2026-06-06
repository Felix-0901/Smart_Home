import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import {
  createBaseSchema,
  ensureSeriesTable,
  quoteIdentifier,
  tableNameForSeries,
  validateSeriesKey
} from "../db/schema.js";
import {
  buildInviteReadingValues,
  isInviteSeriesKey,
  type InviteSeriesKey
} from "./invite-simulator.js";

type ReadingValue = string | number | boolean | null;

export type ReadingValues = Record<string, ReadingValue>;
export type ReadingMetadata = Record<string, unknown>;

export async function insertSeriesReading(
  seriesKey: string,
  values: ReadingValues,
  metadata: ReadingMetadata = {}
) {
  validateSeriesKey(seriesKey);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await ensureSeriesTable(client, seriesKey);

    const tableName = quoteIdentifier(tableNameForSeries(seriesKey));
    const insertResult = await client.query(
      `INSERT INTO ${tableName} (values, metadata) VALUES ($1, $2) RETURNING id, received_at::text AS received_at;`,
      [values, metadata]
    );

    await client.query("COMMIT");

    return {
      seriesKey,
      table: tableNameForSeries(seriesKey),
      reading: insertResult.rows[0] as { id: string; received_at: string }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLatestDeviceReading(seriesKey: string, deviceId: string, kind?: string) {
  validateSeriesKey(seriesKey);
  const client = await pool.connect();

  const tableName = quoteIdentifier(tableNameForSeries(seriesKey));
  const params: string[] = [deviceId];
  const kindFilter = kind ? "AND metadata->>'kind' = $2" : "";

  if (kind) {
    params.push(kind);
  }

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await ensureSeriesTable(client, seriesKey);
    await ensureInviteSimulatedReadings(client, seriesKey, deviceId);

    const result = await client.query(
      `
        SELECT id, values, metadata, received_at::text AS received_at
        FROM ${tableName}
        WHERE metadata->>'device_id' = $1
        ${kindFilter}
        ORDER BY received_at DESC, id DESC
        LIMIT 1;
      `,
      params
    );

    await client.query("COMMIT");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getDeviceReadings(
  seriesKey: string,
  deviceId: string,
  options: {
    from?: string;
    to?: string;
    metric?: string;
    limit?: number;
  } = {}
) {
  validateSeriesKey(seriesKey);
  const client = await pool.connect();

  const tableName = quoteIdentifier(tableNameForSeries(seriesKey));
  const params: Array<string | number> = [deviceId];
  const filters = ["metadata->>'device_id' = $1"];

  if (options.from) {
    params.push(options.from);
    filters.push(`received_at >= $${params.length}::timestamptz`);
  }

  if (options.to) {
    params.push(options.to);
    filters.push(`received_at <= $${params.length}::timestamptz`);
  }

  if (options.metric) {
    params.push(options.metric);
    filters.push(`values ? $${params.length}`);
  }

  params.push(Math.min(Math.max(options.limit ?? 100, 1), 500));

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await ensureSeriesTable(client, seriesKey);
    await ensureInviteSimulatedReadings(client, seriesKey, deviceId);

    const result = await client.query(
      `
        SELECT id, values, metadata, received_at::text AS received_at
        FROM ${tableName}
        WHERE ${filters.join(" AND ")}
        ORDER BY received_at DESC, id DESC
        LIMIT $${params.length};
      `,
      params
    );

    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureInviteSimulatedReadings(client: PoolClient, seriesKey: string, deviceId: string) {
  if (!isInviteSeriesKey(seriesKey)) {
    return;
  }

  const deviceResult = await client.query<{
    product_code: string;
    capabilities: Record<string, unknown>;
  }>(
    `
      SELECT product_code, capabilities
      FROM devices
      WHERE series_key = $1
        AND device_id = $2
        AND capabilities->>'inviteDemo' = 'true'
      LIMIT 1;
    `,
    [seriesKey, deviceId]
  );
  const device = deviceResult.rows[0];

  if (!device) {
    return;
  }

  const tableName = quoteIdentifier(tableNameForSeries(seriesKey));
  const latestResult = await client.query<{
    received_at: string;
    values: Record<string, unknown>;
  }>(
    `
      SELECT values, received_at::text AS received_at
      FROM ${tableName}
      WHERE metadata->>'device_id' = $1
      ORDER BY received_at DESC, id DESC
      LIMIT 1;
    `,
    [deviceId]
  );
  const latestReading = latestResult.rows[0];
  const now = new Date();
  const generatedAt = now.toISOString();
  const initialStepMs = 3 * 60 * 60 * 1000;
  const followUpStepMs = 30 * 60 * 1000;
  const latestAt = latestReading ? new Date(latestReading.received_at) : null;
  const stepMs = latestAt ? followUpStepMs : initialStepMs;
  const firstTimestamp = latestAt
    ? new Date(latestAt.getTime() + followUpStepMs)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (firstTimestamp.getTime() > now.getTime()) {
    return;
  }

  let previousEnergyWh = getNumericValue(latestReading?.values.energy_wh);
  let inserted = 0;

  for (
    let timestamp = firstTimestamp.getTime();
    timestamp <= now.getTime() && inserted < 120;
    timestamp += stepMs
  ) {
    const receivedAt = new Date(timestamp);
    const values = buildInviteReadingValues(seriesKey as InviteSeriesKey, receivedAt, {
      deviceOrdinal: inviteDeviceOrdinal(device.product_code),
      previousEnergyWh
    });
    previousEnergyWh = getNumericValue(values.energy_wh) ?? previousEnergyWh;

    await client.query(
      `
        INSERT INTO ${tableName} (values, metadata, received_at)
        VALUES ($1, $2, $3::timestamptz);
      `,
      [
        values,
        {
          kind: "invite_simulated",
          series_key: seriesKey,
          device_id: deviceId,
          product_code: device.product_code,
          source: "invite_simulator",
          generated_at: generatedAt
        },
        receivedAt.toISOString()
      ]
    );
    inserted += 1;
  }
}

function getNumericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function inviteDeviceOrdinal(productCode: string) {
  const match = productCode.match(/(\d+)$/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}
