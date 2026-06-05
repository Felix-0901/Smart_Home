import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { createBaseSchema } from "../db/schema.js";

const scrypt = promisify(scryptCallback);

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

type AccessTokenPayload = {
  sub: string;
  email: string;
  display_name: string;
  typ: "access";
  iat: number;
  exp: number;
};

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at?: string;
  updated_at?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAppUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensureAppSchema() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(JSON.stringify(value));
}

function signJwt(payload: AccessTokenPayload) {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const body = base64UrlJson(payload);
  const signature = createHmac("sha256", config.APP_JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

function verifyJwtSignature(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const expected = createHmac("sha256", config.APP_JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, salt, storedKey] = passwordHash.split("$");
  if (scheme !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const key = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(storedKey, "base64url");
  return key.length === storedBuffer.length && timingSafeEqual(key, storedBuffer);
}

export function verifyAccessToken(token: string) {
  const payload = verifyJwtSignature(token);
  const now = Math.floor(Date.now() / 1000);

  if (!payload || payload.typ !== "access" || payload.exp <= now) {
    return null;
  }

  return payload;
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

async function createTokens(user: AppUser): Promise<AuthTokens> {
  const now = Math.floor(Date.now() / 1000);
  const accessExp = now + config.APP_ACCESS_TOKEN_TTL_SECONDS;
  const refreshExpiresAt = new Date(
    Date.now() + config.APP_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  const refreshToken = randomBytes(48).toString("base64url");

  await pool.query(
    `
      INSERT INTO app_refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4);
    `,
    [randomUUID(), user.id, hashRefreshToken(refreshToken), refreshExpiresAt.toISOString()]
  );

  return {
    accessToken: signJwt({
      sub: user.id,
      email: user.email,
      display_name: user.displayName,
      typ: "access",
      iat: now,
      exp: accessExp
    }),
    accessTokenExpiresAt: new Date(accessExp * 1000).toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString()
  };
}

export async function createAppUser(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await createBaseSchema(client);

    const result = await client.query<UserRow>(
      `
        INSERT INTO app_users (id, email, password_hash, display_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, password_hash, display_name, created_at::text, updated_at::text;
      `,
      [
        randomUUID(),
        normalizeEmail(input.email),
        await hashPassword(input.password),
        input.displayName.trim()
      ]
    );

    await client.query("COMMIT");
    const user = toAppUser(result.rows[0]);

    return {
      user,
      tokens: await createTokens(user)
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateAppUser(email: string, password: string) {
  await ensureAppSchema();
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, created_at::text, updated_at::text
      FROM app_users
      WHERE email = $1;
    `,
    [normalizeEmail(email)]
  );

  const userRow = result.rows[0];
  if (!userRow || !(await verifyPassword(password, userRow.password_hash))) {
    return null;
  }

  const user = toAppUser(userRow);
  return {
    user,
    tokens: await createTokens(user)
  };
}

export async function getAppUserById(userId: string) {
  await ensureAppSchema();
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, created_at::text, updated_at::text
      FROM app_users
      WHERE id = $1;
    `,
    [userId]
  );

  return result.rows[0] ? toAppUser(result.rows[0]) : null;
}

export async function updateAppUserProfile(
  userId: string,
  input: { email: string; displayName: string }
) {
  await ensureAppSchema();
  const result = await pool.query<UserRow>(
    `
      UPDATE app_users
      SET email = $2, display_name = $3, updated_at = now()
      WHERE id = $1
      RETURNING id, email, password_hash, display_name, created_at::text, updated_at::text;
    `,
    [userId, normalizeEmail(input.email), input.displayName.trim()]
  );

  return result.rows[0] ? toAppUser(result.rows[0]) : null;
}

export async function changeAppUserPassword(userId: string, input: {
  currentPassword: string;
  newPassword: string;
}) {
  await ensureAppSchema();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<UserRow>(
      `
        SELECT id, email, password_hash, display_name, created_at::text, updated_at::text
        FROM app_users
        WHERE id = $1
        FOR UPDATE;
      `,
      [userId]
    );

    const userRow = result.rows[0];
    if (!userRow) {
      await client.query("ROLLBACK");
      return { status: "not_found" as const };
    }

    if (!(await verifyPassword(input.currentPassword, userRow.password_hash))) {
      await client.query("ROLLBACK");
      return { status: "invalid_password" as const };
    }

    const passwordHash = await hashPassword(input.newPassword);
    const updatedResult = await client.query<UserRow>(
      `
        UPDATE app_users
        SET password_hash = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, email, password_hash, display_name, created_at::text, updated_at::text;
      `,
      [userId, passwordHash]
    );

    await client.query(
      `
        UPDATE app_refresh_tokens
        SET revoked_at = now()
        WHERE user_id = $1
          AND revoked_at IS NULL;
      `,
      [userId]
    );

    await client.query("COMMIT");
    return {
      status: "updated" as const,
      user: toAppUser(updatedResult.rows[0])
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAppUser(userId: string) {
  await ensureAppSchema();
  const result = await pool.query(
    `
      DELETE FROM app_users
      WHERE id = $1;
    `,
    [userId]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function refreshAppSession(refreshToken: string) {
  await ensureAppSchema();
  const tokenHash = hashRefreshToken(refreshToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query<UserRow & { token_id: string }>(
      `
        SELECT
          app_refresh_tokens.id AS token_id,
          app_users.id,
          app_users.email,
          app_users.password_hash,
          app_users.display_name,
          app_users.created_at::text,
          app_users.updated_at::text
        FROM app_refresh_tokens
        JOIN app_users ON app_users.id = app_refresh_tokens.user_id
        WHERE app_refresh_tokens.token_hash = $1
          AND app_refresh_tokens.revoked_at IS NULL
          AND app_refresh_tokens.expires_at > now()
        FOR UPDATE;
      `,
      [tokenHash]
    );

    const row = tokenResult.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "UPDATE app_refresh_tokens SET revoked_at = now() WHERE id = $1;",
      [row.token_id]
    );
    await client.query("COMMIT");

    const user = toAppUser(row);
    return {
      user,
      tokens: await createTokens(user)
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeRefreshToken(refreshToken: string) {
  await ensureAppSchema();
  await pool.query(
    `
      UPDATE app_refresh_tokens
      SET revoked_at = now()
      WHERE token_hash = $1
        AND revoked_at IS NULL;
    `,
    [hashRefreshToken(refreshToken)]
  );
}
