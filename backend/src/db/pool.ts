import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL
});

let poolClosed = false;

export async function closePool() {
  if (poolClosed) {
    return;
  }

  poolClosed = true;
  await pool.end();
}
