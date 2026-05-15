import { closePool, pool } from "./pool.js";

async function main() {
  const result = await pool.query("SELECT current_database(), current_user, now();");
  console.log(result.rows[0]);
  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
