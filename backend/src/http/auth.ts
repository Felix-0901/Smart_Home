import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";

export function requireDeviceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-device-token");

  if (token !== config.DEVICE_API_TOKEN) {
    res.status(401).json({ error: "Invalid device token" });
    return;
  }

  next();
}
