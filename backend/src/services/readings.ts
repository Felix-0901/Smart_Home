import { pool } from "../db/pool.js";
import {
  createBaseSchema,
  ensureSeriesTable,
  quoteIdentifier,
  tableNameForSeries,
  validateSeriesKey
} from "../db/schema.js";

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
    await createBaseSchema(client);
    await ensureSeriesTable(client, seriesKey);

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

    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}
