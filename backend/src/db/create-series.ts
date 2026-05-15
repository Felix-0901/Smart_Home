import { closePool, pool } from "./pool.js";
import { createBaseSchema, ensureSeriesTable, validateSeriesKey } from "./schema.js";

async function main() {
  const seriesKey = process.argv[2];
  const displayName = process.argv[3];

  if (!seriesKey) {
    throw new Error("Usage: npm run db:create-series -- <series_key> [display_name]");
  }

  validateSeriesKey(seriesKey);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await ensureSeriesTable(client, seriesKey);

    if (displayName) {
      await client.query(
        "UPDATE hardware_series SET display_name = $1, updated_at = now() WHERE series_key = $2;",
        [displayName, seriesKey]
      );
    }

    await client.query("COMMIT");
    console.log(`Series is ready: ${seriesKey}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
