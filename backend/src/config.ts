import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DEVICE_API_TOKEN: z.string().min(1),
  CORS_ORIGIN: z.string().default("*"),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  APP_JWT_SECRET: z.string().min(32).default("local-dev-app-jwt-secret-change-me-32chars"),
  APP_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  APP_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MQTT_ENABLED: booleanFromEnv.default(true),
  MQTT_BROKER_URL: z.string().url().default("mqtt://localhost:1883"),
  MQTT_USERNAME: optionalNonEmptyString,
  MQTT_PASSWORD: optionalNonEmptyString,
  MQTT_TOPIC_PREFIX: z.string().min(1).default("smart-home"),
  AI_ENABLED: booleanFromEnv.default(false),
  AI_PROVIDER: z.enum(["openai_compatible"]).default("openai_compatible"),
  AI_BASE_URL: z.string().url().default("https://liangjiewis.com"),
  AI_API_KEY: optionalNonEmptyString,
  AI_MODEL: z.string().min(1).default("gpt-5.4"),
  AI_FALLBACK_MODEL: optionalNonEmptyString.default("gpt-4o-mini"),
  AI_PREMIUM_MODEL: optionalNonEmptyString.default("gpt-5.4")
});

export const config = envSchema.parse(process.env);
