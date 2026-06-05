import type { PoolClient } from "pg";

const seriesKeyPattern = /^[a-z0-9][a-z0-9_]{1,48}[a-z0-9]$/;
const schemaAdvisoryLockId = 174876;

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
  await client.query("SELECT pg_advisory_xact_lock($1);", [schemaAdvisoryLockId]);

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_refresh_tokens (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS app_refresh_tokens_user_id_idx
      ON app_refresh_tokens (user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_houses (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS app_houses_user_id_idx
      ON app_houses (user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_house_spaces (
        id UUID PRIMARY KEY,
        house_id UUID NOT NULL REFERENCES app_houses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS app_house_spaces_house_id_idx
      ON app_house_spaces (house_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY,
        product_code TEXT NOT NULL UNIQUE,
        series_key TEXT NOT NULL REFERENCES hardware_series(series_key) ON UPDATE CASCADE,
        device_id TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        model_name TEXT NOT NULL,
        capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
        manufactured_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS devices_series_key_idx
      ON devices (series_key);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        alias TEXT,
        room_name TEXT,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (device_id),
        UNIQUE (user_id, device_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_devices_user_id_idx
      ON user_devices (user_id);
    `);

    await client.query(`
      ALTER TABLE user_devices
      ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES app_houses(id) ON DELETE SET NULL;
    `);

    await client.query(`
      ALTER TABLE user_devices
      ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES app_house_spaces(id) ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_devices_house_id_idx
      ON user_devices (house_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS user_devices_space_id_idx
      ON user_devices (space_id);
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
