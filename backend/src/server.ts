import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config } from "./config.js";
import { closePool } from "./db/pool.js";
import { router } from "./http/routes.js";

const app = express();

app.set("trust proxy", 1);
app.use(cors({
  origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(",").map((origin) => origin.trim())
}));
app.use(express.json({ limit: "128kb" }));
app.use(router);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid request body", details: error.issues });
    return;
  }

  if (error instanceof Error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: "Unknown server error" });
});

const server = app.listen(config.PORT, () => {
  console.log(`Smart Home backend is listening on http://localhost:${config.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
