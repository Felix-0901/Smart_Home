import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { tableNameForSeries, validateSeriesKey } from "../db/schema.js";
import { mqttBridge } from "../mqtt/bridge.js";
import { getLatestDeviceReading, insertSeriesReading } from "../services/readings.js";
import { appRouter } from "./app-routes.js";
import { requireDeviceToken } from "./auth.js";

const readingSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const relayCommandSchema = z.object({
  relay_on: z.boolean()
});

const deviceIdSchema = z.string().regex(
  /^[a-z0-9][a-z0-9_-]{0,63}$/,
  "deviceId must use lowercase letters, numbers, hyphens, or underscores"
);

export const router = Router();

router.use("/api/app", appRouter);

router.get("/health", async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT now()::text AS database_time;");
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
    const result = await insertSeriesReading(seriesKey, body.values, body.metadata ?? {});

    res.status(201).json({
      ok: true,
      seriesKey,
      table: tableNameForSeries(seriesKey),
      reading: result.reading
    });
  } catch (error) {
    next(error);
  }
});

router.post("/api/devices/:deviceId/relay", requireDeviceToken, async (req, res, next) => {
  try {
    const deviceId = deviceIdSchema.parse(req.params.deviceId);
    const body = relayCommandSchema.parse(req.body);
    const result = await mqttBridge.publishRelayCommand(deviceId, body.relay_on);

    res.status(202).json({
      ok: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

router.get("/api/devices/:deviceId/latest", requireDeviceToken, async (req, res, next) => {
  try {
    const deviceId = deviceIdSchema.parse(req.params.deviceId);
    const seriesKey = z.string().default("p_series").parse(req.query.seriesKey);
    const kind = z.string().optional().parse(req.query.kind);
    validateSeriesKey(seriesKey);

    const reading = await getLatestDeviceReading(seriesKey, deviceId, kind);

    res.json({
      ok: true,
      deviceId,
      seriesKey,
      reading
    });
  } catch (error) {
    next(error);
  }
});
