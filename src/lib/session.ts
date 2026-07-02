/**
 * Per-browser session state (sessionStorage), independent of the persisted
 * app-state blob synced to Turso. Keeps sessions out of the shared cloud
 * state so signing in on one browser doesn't affect another.
 *
 * - `sthairya.session` — { userId, expiresAt }
 * - `sthairya.lockouts` — { [username]: { fails, until } }
 * - `sthairya.otp` — { userId, code, expiresAt, sentTo }
 */
const SESSION_KEY = "sthairya.session";
const LOCK_KEY = "sthairya.lockouts";
const OTP_KEY = "sthairya.otp";

const IDLE_MS = 8 * 60 * 60 * 1000; // 8 hours
const LOCK_MAX_FAILS = 4;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface StoredSession {
  userId: string;
  expiresAt: number;
}
export interface StoredOtp {
  userId: string;
  code: string;
  expiresAt: number;
  sentTo: string;
}

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function safeDel(key: string) {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(key); } catch {}
}

export function loadSession(): StoredSession | null {
  const s = safeGet<StoredSession>(SESSION_KEY);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { safeDel(SESSION_KEY); return null; }
  return s;
}
export function saveSession(userId: string): StoredSession {
  const s: StoredSession = { userId, expiresAt: Date.now() + IDLE_MS };
  safeSet(SESSION_KEY, s);
  return s;
}
export function touchSession() {
  const s = loadSession();
  if (s) safeSet(SESSION_KEY, { ...s, expiresAt: Date.now() + IDLE_MS });
}
export function clearSession() { safeDel(SESSION_KEY); }

// ---- lockouts ----
type LockMap = Record<string, { fails: number; until: number }>;
function readLocks(): LockMap { return safeGet<LockMap>(LOCK_KEY) ?? {}; }
function writeLocks(m: LockMap) { safeSet(LOCK_KEY, m); }

export function lockoutRemainingMs(username: string): number {
  const key = username.trim().toLowerCase();
  const m = readLocks();
  const entry = m[key];
  if (!entry) return 0;
  const rem = entry.until - Date.now();
  return rem > 0 ? rem : 0;
}
export function registerLoginFailure(username: string): { locked: boolean; remainingMs: number; failsLeft: number } {
  const key = username.trim().toLowerCase();
  const m = readLocks();
  const entry = m[key] ?? { fails: 0, until: 0 };
  entry.fails += 1;
  if (entry.fails >= LOCK_MAX_FAILS) {
    entry.until = Date.now() + LOCK_MS;
    entry.fails = 0;
    m[key] = entry;
    writeLocks(m);
    return { locked: true, remainingMs: LOCK_MS, failsLeft: 0 };
  }
  m[key] = entry;
  writeLocks(m);
  return { locked: false, remainingMs: 0, failsLeft: LOCK_MAX_FAILS - entry.fails };
}
export function clearLoginFailures(username: string) {
  const key = username.trim().toLowerCase();
  const m = readLocks();
  if (m[key]) { delete m[key]; writeLocks(m); }
}

// ---- OTP ----
export function saveOtp(userId: string, code: string, sentTo: string): StoredOtp {
  const o: StoredOtp = { userId, code, sentTo, expiresAt: Date.now() + OTP_TTL_MS };
  safeSet(OTP_KEY, o);
  return o;
}
export function loadOtp(): StoredOtp | null {
  const o = safeGet<StoredOtp>(OTP_KEY);
  if (!o) return null;
  if (Date.now() > o.expiresAt) { safeDel(OTP_KEY); return null; }
  return o;
}
export function clearOtp() { safeDel(OTP_KEY); }
export const OTP_TTL_MINUTES = OTP_TTL_MS / 60000;
export const LOCK_MINUTES = LOCK_MS / 60000;
