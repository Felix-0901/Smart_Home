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
  MQTT_ENABLED: booleanFromEnv.default(true),
  MQTT_BROKER_URL: z.string().url().default("mqtt://localhost:1883"),
  MQTT_USERNAME: optionalNonEmptyString,
  MQTT_PASSWORD: optionalNonEmptyString,
  MQTT_TOPIC_PREFIX: z.string().min(1).default("smart-home")
});

export const config = envSchema.parse(process.env);
