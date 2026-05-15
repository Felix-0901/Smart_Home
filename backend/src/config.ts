import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DEVICE_API_TOKEN: z.string().min(1),
  CORS_ORIGIN: z.string().default("*"),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:3000")
});

export const config = envSchema.parse(process.env);
