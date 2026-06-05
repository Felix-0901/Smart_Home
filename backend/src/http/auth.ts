import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { getAppUserById, verifyAccessToken, type AppUser } from "../services/app-auth.js";

export type AppUserRequest = Request & {
  appUser?: AppUser;
};

export function requireDeviceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-device-token");

  if (token !== config.DEVICE_API_TOKEN) {
    res.status(401).json({ error: "Invalid device token" });
    return;
  }

  next();
}

export async function requireAppUser(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Missing app access token" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload) {
      res.status(401).json({ error: "Invalid or expired app access token" });
      return;
    }

    const user = await getAppUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "App user no longer exists" });
      return;
    }

    (req as AppUserRequest).appUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function getRequiredAppUser(req: Request) {
  const user = (req as AppUserRequest).appUser;
  if (!user) {
    throw new Error("App user is required");
  }

  return user;
}
