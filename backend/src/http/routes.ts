import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import {
  createBaseSchema,
  ensureSeriesTable,
  quoteIdentifier,
  tableNameForSeries,
  validateSeriesKey
} from "../db/schema.js";
import { requireDeviceToken } from "./auth.js";

const readingSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const router = Router();

router.get("/health", async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT now() AS database_time;");
    res.json({
      ok: true,
      publicUrl: config.APP_PUBLIC_URL,
      databaseTime: result.rows[0].database_time
    });
  } catch (error) {
    next(error);
  }
});

router.post("/api/series/:seriesKey/readings", requireDeviceToken, async (req, res, next) => {
  try {
    const seriesKey = z.string().parse(req.params.seriesKey);
    validateSeriesKey(seriesKey);

    const body = readingSchema.parse(req.body);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await createBaseSchema(client);
      await ensureSeriesTable(client, seriesKey);

      const tableName = quoteIdentifier(tableNameForSeries(seriesKey));
      const insertResult = await client.query(
        `INSERT INTO ${tableName} (values, metadata) VALUES ($1, $2) RETURNING id, received_at;`,
        [body.values, body.metadata ?? {}]
      );

      await client.query("COMMIT");

      res.status(201).json({
        ok: true,
        seriesKey,
        table: tableNameForSeries(seriesKey),
        reading: insertResult.rows[0]
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});
