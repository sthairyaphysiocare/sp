/**
 * PBKDF2-SHA256 password hashing using Web Crypto (Cloudflare Worker safe).
 * bcrypt / argon2 require native Node modules and don't run on workerd.
 *
 * Format: pbkdf2$<iterations>$<saltB64>$<hashB64>
 */
const ITERATIONS = 210_000;
const SALT_LEN = 16;
const HASH_LEN = 32;
const PREFIX = "pbkdf2";

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  // btoa is available in workerd + browser
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_LEN * 8,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `${PREFIX}$${ITERATIONS}$${b64encode(salt.buffer)}$${b64encode(hash)}`;
}

export function isHashed(value: string): boolean {
  return typeof value === "string" && value.startsWith(`${PREFIX}$`);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isHashed(stored)) {
    // Legacy plaintext (pre-migration) — allow one-time equality, caller
    // is responsible for re-hashing after successful login.
    return password === stored;
  }
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  const salt = b64decode(parts[2]);
  const expected = b64decode(parts[3]);
  const actualBuf = await pbkdf2(password, salt, iterations);
  const actual = new Uint8Array(actualBuf);
  if (actual.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
