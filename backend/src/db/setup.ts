import { closePool, pool } from "./pool.js";
import { createBaseSchema } from "./schema.js";

async function main() {
  const client = await pool.connect();

  try {
    await createBaseSchema(client);
    console.log("Database schema is ready.");
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
