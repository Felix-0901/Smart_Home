import { closePool, pool } from "./pool.js";
import { createBaseSchema } from "./schema.js";

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await client.query("COMMIT");
    console.log("Database schema is ready.");
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
