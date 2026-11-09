import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults: argon2id, m=19456 KiB, t=2, p=1 (OWASP minimum recommendation).

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Never throws on malformed hashes; a failed check is just `false`. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
