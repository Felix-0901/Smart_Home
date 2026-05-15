import type { PoolClient } from "pg";

const seriesKeyPattern = /^[a-z0-9][a-z0-9_]{1,48}[a-z0-9]$/;

export function validateSeriesKey(seriesKey: string) {
  if (!seriesKeyPattern.test(seriesKey)) {
    throw new Error("seriesKey must use lowercase letters, numbers, and underscores only");
  }
}

export function tableNameForSeries(seriesKey: string) {
  validateSeriesKey(seriesKey);
  return `series_${seriesKey}_readings`;
}

export function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export async function createBaseSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS hardware_series (
      id BIGSERIAL PRIMARY KEY,
      series_key TEXT NOT NULL UNIQUE,
      display_name TEXT,
      board_name TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function ensureSeriesTable(client: PoolClient, seriesKey: string) {
  const tableName = quoteIdentifier(tableNameForSeries(seriesKey));

  await client.query(
    `
      INSERT INTO hardware_series (series_key)
      VALUES ($1)
      ON CONFLICT (series_key) DO UPDATE
      SET updated_at = now();
    `,
    [seriesKey]
  );

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id BIGSERIAL PRIMARY KEY,
      values JSONB NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      received_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${tableNameForSeries(seriesKey)}_received_at_idx`)}
    ON ${tableName} (received_at DESC);
  `);
}
