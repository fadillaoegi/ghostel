import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url, no padding

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/** `__Host-` prefix forces Secure, Path=/ and no Domain; browsers require HTTPS for it. */
export function sessionCookieName(production: boolean): string {
  return production ? "__Host-ghostel_sid" : "ghostel_sid";
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function sessionCookieOptions(production: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: production,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
