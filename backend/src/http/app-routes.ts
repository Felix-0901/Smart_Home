import { Router, type Response } from "express";
import { z } from "zod";
import {
  authenticateAppUser,
  changeAppUserPassword,
  createAppUser,
  deleteAppUser,
  refreshAppSession,
  revokeRefreshToken,
  updateAppUserProfile
} from "../services/app-auth.js";
import {
  claimDevice,
  deleteUserDevice,
  DeviceClaimError,
  DeviceUpdateError,
  getUserDevice,
  listUserDevices,
  updateUserDevice
} from "../services/app-devices.js";
import {
  createHouse,
  createHouseSpace,
  deleteHouse,
  deleteHouseSpace,
  getUserHouse,
  HouseError,
  listUserHouses,
  updateHouse,
  updateHouseSpace
} from "../services/app-houses.js";
import { getDeviceReadings, getLatestDeviceReading } from "../services/readings.js";
import { mqttBridge } from "../mqtt/bridge.js";
import { getRequiredAppUser, requireAppUser } from "./auth.js";

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(8).max(128);
const displayNameSchema = z.string().trim().min(1).max(80);
const uuidParamSchema = z.string().uuid();
const metricSchema = z.string().trim().regex(/^[a-zA-Z0-9_.-]{1,64}$/);

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(32)
});

const profileSchema = z.object({
  displayName: displayNameSchema
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ["newPassword"],
  message: "新密碼不可與舊密碼相同"
});

const claimSchema = z.object({
  productCode: z.string().trim().min(3).max(64)
});

const nullableDeviceTextSchema = z.union([z.string().trim().min(1).max(80), z.null()]);
const nullableUuidSchema = z.union([uuidParamSchema, z.null()]);
const houseNameSchema = z.string().trim().min(1).max(80);

const updateDeviceSchema = z.object({
  alias: nullableDeviceTextSchema.optional(),
  roomName: nullableDeviceTextSchema.optional(),
  houseId: nullableUuidSchema.optional(),
  spaceId: nullableUuidSchema.optional()
});

const houseSchema = z.object({
  name: houseNameSchema
});

const readingsQuerySchema = z.object({
  from: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "from must be a valid date").optional(),
  to: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "to must be a valid date").optional(),
  metric: metricSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

const relaySchema = z.object({
  relay_on: z.boolean()
});

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function sendKnownAppError(res: Response, error: unknown) {
  if (error instanceof DeviceClaimError || error instanceof DeviceUpdateError || error instanceof HouseError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }

  return false;
}

export const appRouter = Router();

appRouter.post("/auth/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await createAppUser(body);

    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "這個 Email 已經註冊過" });
      return;
    }

    next(error);
  }
});

appRouter.post("/auth/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authenticateAppUser(body.email, body.password);

    if (!result) {
      res.status(401).json({ error: "Email 或密碼不正確" });
      return;
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

appRouter.post("/auth/refresh", async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    const result = await refreshAppSession(body.refreshToken);

    if (!result) {
      res.status(401).json({ error: "Refresh token 已失效" });
      return;
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

appRouter.post("/auth/logout", async (req, res, next) => {
  try {
    const body = refreshSchema.parse(req.body);
    await revokeRefreshToken(body.refreshToken);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

appRouter.get("/me", requireAppUser, (req, res) => {
  res.json({ ok: true, user: getRequiredAppUser(req) });
});

appRouter.patch("/me", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const body = profileSchema.parse(req.body);
    const updatedUser = await updateAppUserProfile(user.id, body);
    res.json({ ok: true, user: updatedUser });
  } catch (error) {
    next(error);
  }
});

appRouter.patch("/me/password", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const body = passwordChangeSchema.parse(req.body);
    const result = await changeAppUserPassword(user.id, body);

    if (result.status === "not_found") {
      res.status(404).json({ error: "找不到帳號" });
      return;
    }

    if (result.status === "invalid_password") {
      res.status(401).json({ error: "舊密碼不正確" });
      return;
    }

    res.json({ ok: true, user: result.user });
  } catch (error) {
    next(error);
  }
});

appRouter.delete("/me", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const deleted = await deleteAppUser(user.id);

    if (!deleted) {
      res.status(404).json({ error: "找不到帳號" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

appRouter.get("/houses", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const houses = await listUserHouses(user.id);
    res.json({ ok: true, houses });
  } catch (error) {
    next(error);
  }
});

appRouter.post("/houses", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const body = houseSchema.parse(req.body);
    const house = await createHouse(user.id, body.name);
    res.status(201).json({ ok: true, house });
  } catch (error) {
    if (sendKnownAppError(res, error)) {
      return;
    }

    next(error);
  }
});

appRouter.get("/houses/:houseId", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const houseId = uuidParamSchema.parse(req.params.houseId);
    const house = await getUserHouse(user.id, houseId);

    if (!house) {
      res.status(404).json({ error: "找不到房屋" });
      return;
    }

    res.json({ ok: true, house });
  } catch (error) {
    next(error);
  }
});

appRouter.patch("/houses/:houseId", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const houseId = uuidParamSchema.parse(req.params.houseId);
    const body = houseSchema.parse(req.body);
    const house = await updateHouse(user.id, houseId, body.name);

    if (!house) {
      res.status(404).json({ error: "找不到房屋" });
      return;
    }

    res.json({ ok: true, house });
  } catch (error) {
    if (sendKnownAppError(res, error)) {
      return;
    }

    next(error);
  }
});

appRouter.delete("/houses/:houseId", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const houseId = uuidParamSchema.parse(req.params.houseId);
    const deleted = await deleteHouse(user.id, houseId);

    if (!deleted) {
      res.status(404).json({ error: "找不到房屋" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

appRouter.post("/houses/:houseId/spaces", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const houseId = uuidParamSchema.parse(req.params.houseId);
    const body = houseSchema.parse(req.body);
    const space = await createHouseSpace(user.id, houseId, body.name);
    res.status(201).json({ ok: true, space });
  } catch (error) {
    if (sendKnownAppError(res, error)) {
      return;
    }

    next(error);
  }
});

appRouter.patch("/houses/:houseId/spaces/:spaceId", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const houseId = uuidParamSchema.parse(req.params.houseId);
    const spaceId = uuidParamSchema.parse(req.params.spaceId);
    const body = houseSchema.parse(req.body);
    const space = await updateHouseSpace(user.id, houseId, spaceId, body.name);

    if (!space) {
      res.status(404).json({ error: "找不到空間" });
      return;
    }

    res.json({ ok: true, space });
  } catch (error) {
    next(error);
  }
});

appRouter.delete("/houses/:houseId/spaces/:spaceId", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const houseId = uuidParamSchema.parse(req.params.houseId);
    const spaceId = uuidParamSchema.parse(req.params.spaceId);
    const deleted = await deleteHouseSpace(user.id, houseId, spaceId);

    if (!deleted) {
      res.status(404).json({ error: "找不到空間" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

appRouter.get("/devices", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const devices = await listUserDevices(user.id);
    res.json({ ok: true, devices });
  } catch (error) {
    next(error);
  }
});

appRouter.post("/devices/claim", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const body = claimSchema.parse(req.body);
    const device = await claimDevice(user.id, body.productCode);
    res.status(201).json({ ok: true, device });
  } catch (error) {
    if (sendKnownAppError(res, error)) {
      return;
    }

    next(error);
  }
});

appRouter.patch("/devices/:deviceId", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const deviceUuid = uuidParamSchema.parse(req.params.deviceId);
    const body = updateDeviceSchema.parse(req.body);
    const device = await updateUserDevice(user.id, deviceUuid, body);

    if (!device) {
      res.status(404).json({ error: "找不到已綁定裝置" });
      return;
    }

    res.json({ ok: true, device });
  } catch (error) {
    if (sendKnownAppError(res, error)) {
      return;
    }

    next(error);
  }
});

appRouter.delete("/devices/:deviceId", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const deviceUuid = uuidParamSchema.parse(req.params.deviceId);
    const deleted = await deleteUserDevice(user.id, deviceUuid);

    if (!deleted) {
      res.status(404).json({ error: "找不到已綁定裝置" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

appRouter.get("/devices/:deviceId/latest", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const deviceUuid = uuidParamSchema.parse(req.params.deviceId);
    const device = await getUserDevice(user.id, deviceUuid);

    if (!device) {
      res.status(404).json({ error: "找不到已綁定裝置" });
      return;
    }

    const reading = await getLatestDeviceReading(device.seriesKey, device.deviceId);
    res.json({ ok: true, device, reading });
  } catch (error) {
    next(error);
  }
});

appRouter.get("/devices/:deviceId/readings", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const deviceUuid = uuidParamSchema.parse(req.params.deviceId);
    const device = await getUserDevice(user.id, deviceUuid);

    if (!device) {
      res.status(404).json({ error: "找不到已綁定裝置" });
      return;
    }

    const query = readingsQuerySchema.parse(req.query);
    const readings = await getDeviceReadings(device.seriesKey, device.deviceId, query);

    res.json({ ok: true, device, readings });
  } catch (error) {
    next(error);
  }
});

appRouter.post("/devices/:deviceId/relay", requireAppUser, async (req, res, next) => {
  try {
    const user = getRequiredAppUser(req);
    const deviceUuid = uuidParamSchema.parse(req.params.deviceId);
    const body = relaySchema.parse(req.body);
    const device = await getUserDevice(user.id, deviceUuid);

    if (!device) {
      res.status(404).json({ error: "找不到已綁定裝置" });
      return;
    }

    if (device.seriesKey !== "p_series") {
      res.status(400).json({ error: "只有 P 系列智慧插座支援 relay 控制" });
      return;
    }

    const command = await mqttBridge.publishRelayCommand(device.deviceId, body.relay_on);
    res.status(202).json({ ok: true, command });
  } catch (error) {
    if (error instanceof Error && error.message.includes("MQTT bridge")) {
      res.status(503).json({ error: error.message });
      return;
    }

    next(error);
  }
});
