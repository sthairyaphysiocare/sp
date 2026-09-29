/**
 * Cloudinary — server-side signing and verification.
 *
 * WHY EVERY UPLOAD IS SIGNED
 *
 * Cloudinary also offers "unsigned" upload presets, where the browser posts
 * straight to Cloudinary with nothing but a preset name. That name is
 * necessarily public, so anyone who views the page can upload anything into
 * the clinic's account until the free quota is exhausted. Unsigned presets
 * must stay disabled in the Cloudinary console.
 *
 * Instead the browser asks THIS server for a short-lived ticket. The server
 * decides the folder, the public id and the expiry, signs them with a secret
 * that never leaves the server, and returns only the signature. Cloudinary
 * then rejects any upload whose parameters differ by even one character from
 * the ones that were signed — so the browser cannot change the folder, cannot
 * overwrite an existing asset, and cannot upload at all without first being
 * issued a ticket.
 *
 * AND WHY THE RESULT IS STILL VERIFIED
 *
 * The browser reports back what it uploaded, and a browser can lie. So before
 * anything is recorded, the server asks Cloudinary's Admin API what the asset
 * actually is — real byte size, real format, real dimensions. Rules are
 * enforced against that answer, never against what the client claimed.
 *
 * SIGNATURE FORMAT
 *
 * Implemented from Cloudinary's own SDK (cloudinary@2.11.0,
 * lib/utils/index.js: api_string_to_sign / api_sign_request), not from
 * memory, because two details are easy to get wrong and both are load-bearing:
 *
 *   1. Signature version 2 — the current default — percent-encodes "&" inside
 *      each "key=value" pair before joining. Version 1 did not, which allowed
 *      a value containing "&" to smuggle in extra parameters.
 *   2. Parameters whose value is null, undefined or "" are dropped BEFORE
 *      signing, so the string signed here matches the one Cloudinary rebuilds.
 *
 *   sorted("key=value" with & -> %26) joined by "&", then + api_secret,
 *   then SHA-1 (Cloudinary's default), hex encoded.
 *
 * FAIL-CLOSED
 *
 * With no credentials configured every function here returns null or false.
 * Nothing silently uploads to, or deletes from, an account that was never set
 * up, and no caller can mistake "unconfigured" for "allowed".
 */

const API_BASE = "https://api.cloudinary.com/v1_1";

/** Tickets are deliberately short-lived; Cloudinary also rejects stale ones. */
const TICKET_TTL_SECONDS = 10 * 60;

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** "sha1" (Cloudinary's default) or "sha256" if the account is set to it. */
  algorithm: "sha1" | "sha256";
}

/**
 * Credentials, or null when the deployment has none. Read per call rather
 * than cached, so adding the secrets takes effect on the next request without
 * a redeploy.
 */
export function cloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  const algo = (process.env.CLOUDINARY_SIGNATURE_ALGORITHM || "sha1").trim().toLowerCase();
  return {
    cloudName,
    apiKey,
    apiSecret,
    algorithm: algo === "sha256" ? "sha256" : "sha1",
  };
}

export function cloudinaryConfigured(): boolean {
  return cloudinaryConfig() !== null;
}

function hex(buf: ArrayBuffer): string {
  let out = "";
  for (const b of new Uint8Array(buf)) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * Build the exact string Cloudinary will rebuild on its side.
 * Mirrors api_string_to_sign at signature version 2.
 */
export function stringToSign(params: Record<string, string | number | undefined | null>): string {
  return (
    Object.entries(params)
      .map(([k, v]) => [String(k), v] as const)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .sort((a, b) => a[0].localeCompare(b[0]))
      // Version 2 encodes "&" within the pair so a value cannot smuggle in
      // another parameter. Dropping this silently reintroduces that hole.
      .map(([k, v]) => `${k}=${String(v)}`.replace(/&/g, "%26"))
      .join("&")
  );
}

async function sign(
  params: Record<string, string | number | undefined | null>,
  cfg: CloudinaryConfig,
): Promise<string> {
  const data = new TextEncoder().encode(stringToSign(params) + cfg.apiSecret);
  const algo = cfg.algorithm === "sha256" ? "SHA-256" : "SHA-1";
  return hex(await crypto.subtle.digest(algo, data));
}

/**
 * Cloudinary keeps images and videos in separate resource types, and every
 * endpoint — upload, inspect, delete — is addressed by type. Getting this
 * wrong does not error loudly; it quietly looks in the wrong place, which is
 * why it is threaded through explicitly rather than inferred from a filename.
 */
export type MediaKind = "image" | "video";

export interface UploadTicket {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  kind: MediaKind;
  /** Exactly the fields that were signed — the browser must post these verbatim. */
  params: Record<string, string | number>;
  signature: string;
}

/**
 * Mint a ticket for one upload of one specific asset.
 *
 * The caller decides folder and public id; the browser cannot alter either,
 * because changing them invalidates the signature. `overwrite: false` means a
 * ticket can never be replayed to clobber an asset that already exists.
 *
 * Returns null when Cloudinary is not configured.
 */
export async function signUploadTicket(opts: {
  folder: string;
  publicId: string;
  kind: MediaKind;
}): Promise<UploadTicket | null> {
  const cfg = cloudinaryConfig();
  if (!cfg) {
    console.warn("[cloudinary] not configured — no upload ticket issued.");
    return null;
  }

  const params: Record<string, string | number> = {
    // Cloudinary rejects a timestamp far from its own clock, which caps how
    // long a leaked ticket stays usable.
    timestamp: Math.floor(Date.now() / 1000),
    folder: opts.folder,
    public_id: opts.publicId,
    // Never let an upload replace an asset that already exists.
    overwrite: "false",
  };
  // Camera metadata (including any GPS coordinates) is stripped from photos.
  // The flag is image-only; sending it on a video upload changes the signed
  // string and Cloudinary then rejects the whole upload.
  if (opts.kind === "image") params.exif = "false";

  return {
    cloudName: cfg.cloudName,
    apiKey: cfg.apiKey,
    uploadUrl: `${API_BASE}/${cfg.cloudName}/${opts.kind}/upload`,
    kind: opts.kind,
    params,
    signature: await sign(params, cfg),
  };
}

export interface AssetInfo {
  publicId: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  secureUrl: string;
  version: number;
  /** Videos only; seconds. 0 for images. */
  duration: number;
}

function basicAuth(cfg: CloudinaryConfig): string {
  return `Basic ${btoa(`${cfg.apiKey}:${cfg.apiSecret}`)}`;
}

/**
 * Ask Cloudinary what an asset actually is.
 *
 * This is the only trustworthy source for size and format: the browser's
 * report of its own upload is an assertion, not evidence. Returns null if the
 * asset does not exist, the credentials are missing, or the call fails —
 * callers treat null as "do not record this".
 */
export async function inspectAsset(
  publicId: string,
  kind: MediaKind = "image",
): Promise<AssetInfo | null> {
  const cfg = cloudinaryConfig();
  if (!cfg || !publicId) return null;
  try {
    // The public id may contain slashes (it includes the folder), and those
    // are path separators here — encoding them would ask Cloudinary for an
    // asset whose name literally contains "%2F", which does not exist.
    const path = publicId
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const url = `${API_BASE}/${cfg.cloudName}/resources/${kind}/upload/${path}`;
    const res = await fetch(url, { headers: { Authorization: basicAuth(cfg) } });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    if (typeof j.public_id !== "string") return null;
    return {
      publicId: j.public_id,
      format: String(j.format ?? ""),
      bytes: Number(j.bytes ?? 0),
      width: Number(j.width ?? 0),
      height: Number(j.height ?? 0),
      secureUrl: String(j.secure_url ?? ""),
      version: Number(j.version ?? 0),
      duration: Number(j.duration ?? 0),
    };
  } catch (err) {
    console.error("[cloudinary] inspectAsset failed:", err);
    return null;
  }
}

/**
 * Delete one asset from Cloudinary.
 *
 * Deliberately narrow: it takes a single public id and there is no bulk or
 * prefix variant anywhere in this file, so no code path — and no mistake in
 * one — can clear a folder. Patient records live in Turso and are untouched
 * by anything here.
 */
export async function destroyAsset(publicId: string, kind: MediaKind = "image"): Promise<boolean> {
  const cfg = cloudinaryConfig();
  if (!cfg || !publicId) return false;
  try {
    const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
    const body = new URLSearchParams({
      public_id: params.public_id,
      timestamp: String(params.timestamp),
      api_key: cfg.apiKey,
      signature: await sign(params, cfg),
    });
    const res = await fetch(`${API_BASE}/${cfg.cloudName}/${kind}/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;
    const j = (await res.json()) as { result?: string };
    // "not found" also means the asset is gone, which is the desired end state.
    return j.result === "ok" || j.result === "not found";
  } catch (err) {
    console.error("[cloudinary] destroyAsset failed:", err);
    return false;
  }
}

/** Seconds a freshly issued ticket stays plausible; exported for tests. */
export const TICKET_TTL = TICKET_TTL_SECONDS;

/**
 * Rewrite a Cloudinary URL to request a transformed version.
 *
 * Serving originals is what actually exhausts the free tier: the allowance is
 * shared across storage, transformations and delivery, and delivery is by far
 * the largest of the three for a gallery. Asking for a width cap plus
 * automatic format and quality typically cuts the bytes several-fold, and
 * Cloudinary caches each derived asset so the transformation is charged once,
 * not per view.
 *
 * Returns the URL unchanged if it is not a Cloudinary delivery URL, so a
 * malformed or foreign URL degrades to "show the original" rather than
 * breaking the image.
 */
export function transformedUrl(secureUrl: string, transform: string): string {
  if (!secureUrl || !transform) return secureUrl;
  const marker = "/upload/";
  const i = secureUrl.indexOf(marker);
  if (i === -1) return secureUrl;
  const head = secureUrl.slice(0, i + marker.length);
  const tail = secureUrl.slice(i + marker.length);
  // Already transformed (a previous call, or a URL that arrived with one):
  // leave it alone rather than stacking transformations on top of each other.
  if (/^[a-z]{1,3}_[^/]+\//.test(tail)) return secureUrl;
  return `${head}${transform}/${tail}`;
}
