import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Admin password hashing with scrypt (memory-hard).
 * Stored format (ADMIN_PASSWORD_HASH): scrypt:<N>:<r>:<p>:<salt b64>:<hash b64>
 * (":" rather than "$" so .env variable expansion can never mangle it)
 * The plaintext password is never stored or compared directly.
 */

const KEY_LENGTH = 64;
const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 1 };

function deriveKey(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const { N, r, p } = DEFAULT_PARAMS;
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, N, r, p);
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join(":");
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored || typeof password !== "string" || password.length === 0 || password.length > 1024) return false;
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger) || N < 2 ** 14 || N > 2 ** 20) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await deriveKey(password, salt, N, r, p);
  return timingSafeEqual(actual, expected);
}
