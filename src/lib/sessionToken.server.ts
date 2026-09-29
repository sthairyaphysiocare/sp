/**
 * Signed session tokens — server-issued, server-verified.
 *
 * WHY THIS EXISTS
 *
 * Sessions previously lived only in the browser's sessionStorage, and no
 * identity was ever sent to the server. Every server function therefore
 * accepted requests from anyone who knew the endpoint existed — including the
 * one that writes the whole patient database. The admin UI "checking" the role
 * client-side is decoration: it is trivially bypassed by calling the endpoint
 * directly.
 *
 * A shared upload secret does NOT fix this. For the admin UI to send such a
 * secret it must either be compiled into the public JavaScript bundle or be
 * fetched from an endpoint that is itself unauthenticated — so in both cases
 * anyone can obtain it. Only a token the SERVER issues and can itself verify
 * closes the hole.
 *
 * HOW IT WORKS
 *
 * On a successful password check the server mints
 *
 *     base64url(payload) "." base64url(HMAC-SHA256(payload, SESSION_SECRET))
 *
 * The payload carries the user id, their role and an expiry. The signature is
 * produced with a secret that exists only in server environment variables, so
 * a token cannot be forged or its role escalated without it. Verification
 * recomputes the signature and compares it in constant time.
 *
 * FAIL-CLOSED
 *
 * If SESSION_SECRET is missing or malformed, issuing returns null and
 * verification REJECTS. An unconfigured deployment therefore denies protected
 * actions rather than silently allowing them — the failure mode is "nobody can
 * upload", never "everybody can".
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface SessionClaims {
  /** User id. */
  uid: string;
  /** Role at the time the token was issued. */
  role: string;
  /** Expiry, epoch ms. */
  exp: number;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * The signing secret. Deliberately NOT falling back to a default: a hardcoded
 * fallback would mean every deployment shares a key an attacker can read in
 * the source, which is worse than having no tokens at all.
 */
function secret(): string | null {
  const v = process.env.SESSION_SECRET || "";
  // A short secret is not a usable HMAC key; treat it as unconfigured rather
  // than pretending it provides protection.
  return v.length >= 32 ? v : null;
}

async function hmac(payloadB64: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(payloadB64));
  return b64urlEncode(new Uint8Array(sig));
}

/** Constant-time string compare, so a bad signature leaks no timing signal. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mint a signed token. Returns null when no usable secret is configured. */
export async function issueSessionToken(uid: string, role: string): Promise<string | null> {
  const key = secret();
  if (!key) {
    console.warn(
      "[session-token] SESSION_SECRET is not set (or is under 32 chars) — no token issued, so protected actions will be denied.",
    );
    return null;
  }
  const claims: SessionClaims = { uid, role, exp: Date.now() + TOKEN_TTL_MS };
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  return `${payload}.${await hmac(payload, key)}`;
}

/**
 * Verify a token and return its claims, or null if it is missing, malformed,
 * unsigned, wrongly signed, expired, or the server has no secret configured.
 * Every failure path returns null — this never throws and never fails open.
 */
export async function verifySessionToken(token: unknown): Promise<SessionClaims | null> {
  try {
    const key = secret();
    if (!key) return null;
    if (typeof token !== "string" || token.length < 8 || token.length > 4096) return null;
    const dot = token.indexOf(".");
    if (dot <= 0) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!payload || !sig) return null;

    const expected = await hmac(payload, key);
    if (!timingSafeEqual(sig, expected)) return null;

    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as SessionClaims;
    if (!claims || typeof claims.uid !== "string" || typeof claims.role !== "string") return null;
    if (typeof claims.exp !== "number" || Date.now() > claims.exp) return null;
    return claims;
  } catch {
    // Malformed input must be a plain rejection, not an error the caller
    // might mistake for something else.
    return null;
  }
}

/** Verified claims if the token belongs to an admin, else null. */
export async function verifyAdmin(token: unknown): Promise<SessionClaims | null> {
  const claims = await verifySessionToken(token);
  return claims && claims.role === "admin" ? claims : null;
}
