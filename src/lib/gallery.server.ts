/**
 * Clinic gallery — storage layer.
 *
 * WHERE THE MEDIA LIVES
 *
 * The image and video bytes live in Cloudinary; this table holds only a
 * reference to each one plus its caption, description, order and visibility.
 * No file of any size is ever written to the database. Nothing here stores or
 * reads patient data.
 *
 * WHY GALLERY ROWS CANNOT BE WIPED BY A SYNC
 *
 * syncState() reconciles six tables against what the browser sends, and
 * gallery_items is not one of them. A client sync therefore has no way to
 * touch a gallery row even if it tried: there is no code path from the sync
 * payload to this table. Every change comes through an explicit,
 * admin-authenticated call below, and each one affects exactly one row.
 *
 * The same is true of the on/off switch. It lives in app_settings under the
 * id 'gallery', while the sync path only ever reads and writes the row keyed
 * 'main' — so syncing clinic settings cannot turn the gallery on or off, and
 * turning the gallery on or off cannot disturb clinic settings.
 *
 * WHY LIMITS ARE CHECKED AGAINST CLOUDINARY, NOT THE BROWSER
 *
 * A browser can claim any size and format it likes. addGalleryItem() ignores
 * what it was told and asks Cloudinary what the asset actually is; media that
 * breaks the rules is deleted from Cloudinary and never recorded. An asset
 * Cloudinary cannot confirm is likewise never recorded.
 */

import { turso, auditEvent } from "./turso.server";
import { ensureSchema } from "./schema.server";
import {
  inspectAsset,
  destroyAsset,
  transformedUrl,
  cloudinaryConfigured,
  type MediaKind,
} from "./cloudinary.server";

/** Folder every gallery asset is confined to. */
export const GALLERY_FOLDER = "sthairya/gallery";

/** Per-image ceiling, enforced against Cloudinary's reported byte count. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Per-video ceiling. Higher than an image because no useful clip fits in 2MB,
 * but still deliberately tight: a looping video that plays on every visit is
 * the single largest consumer of the free delivery allowance.
 */
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

/**
 * Ceiling on how many items the gallery can hold.
 *
 * Not a storage limit — storage is nowhere near the constraint. It is a
 * delivery-bandwidth guard: the free Cloudinary tier shares one monthly
 * allowance between storage, transformations and bandwidth, and a page that
 * loads every item on every visit is what would exhaust it.
 */
export const MAX_ITEMS = 60;

/** Videos cost far more bandwidth per view than photos, so they are capped separately. */
export const MAX_VIDEOS = 8;

const ALLOWED_IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);
const ALLOWED_VIDEO_FORMATS = new Set(["mp4", "webm", "mov"]);

/**
 * Delivery transformations. `f_auto` picks a modern format per browser,
 * `q_auto` picks a quality the eye cannot distinguish from the original, and
 * the width cap stops a 4000px phone photo being sent to a 400px card.
 */
const IMG_CARD = "f_auto,q_auto,w_800,c_limit";
const IMG_FULL = "f_auto,q_auto,w_1920,c_limit";
const VID_CARD = "f_auto,q_auto,w_800,c_limit";
const VID_POSTER = "f_auto,q_auto,w_800,c_limit,so_0";

export interface GalleryItem {
  id: string;
  publicId: string;
  kind: MediaKind;
  /** Full-size delivery URL, used by the lightbox. */
  url: string;
  /** Smaller delivery URL, used by the grid card. */
  thumbUrl: string;
  /** First video frame, shown while the clip loads. Empty for images. */
  posterUrl: string;
  alt: string;
  caption: string;
  description: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  duration: number;
  position: number;
  visible: boolean;
  createdAt: number;
  createdBy: string;
}

function rowToItem(r: Record<string, unknown>): GalleryItem {
  const kind: MediaKind = String(r.kind ?? "image") === "video" ? "video" : "image";
  const raw = String(r.url ?? "");
  return {
    id: String(r.id ?? ""),
    publicId: String(r.public_id ?? ""),
    kind,
    url: transformedUrl(raw, kind === "video" ? VID_CARD : IMG_FULL),
    thumbUrl: transformedUrl(raw, kind === "video" ? VID_CARD : IMG_CARD),
    posterUrl:
      kind === "video" ? transformedUrl(raw, VID_POSTER).replace(/\.(mp4|webm|mov)$/i, ".jpg") : "",
    alt: String(r.alt ?? ""),
    caption: String(r.caption ?? ""),
    description: String(r.description ?? ""),
    width: Number(r.width ?? 0),
    height: Number(r.height ?? 0),
    bytes: Number(r.bytes ?? 0),
    format: String(r.format ?? ""),
    duration: Number(r.duration ?? 0),
    position: Number(r.position ?? 0),
    visible: Number(r.visible ?? 0) === 1,
    createdAt: Number(r.created_at ?? 0),
    createdBy: String(r.created_by ?? ""),
  };
}

// ---------------------------------------------------------------------------
// The on/off switch
// ---------------------------------------------------------------------------

/**
 * Whether the gallery appears on the public site.
 *
 * Stored in its own app_settings row (id 'gallery'), which the sync path never
 * reads or writes — it only ever touches the row keyed 'main'. So this cannot
 * be flipped by a stale browser tab syncing old clinic settings, and writing
 * it cannot endanger the clinic configuration.
 *
 * Defaults to OFF. A gallery that switched itself on the moment the table
 * appeared would publish an empty section without anyone choosing to.
 */
export async function galleryEnabled(): Promise<boolean> {
  await ensureSchema();
  try {
    const res = await turso().execute({
      sql: `SELECT data FROM app_settings WHERE id = ?`,
      args: ["gallery"],
    });
    if (res.rows.length === 0) return false;
    const parsed = JSON.parse(String((res.rows[0] as Record<string, unknown>).data ?? "{}"));
    return parsed?.enabled === true;
  } catch (err) {
    // A corrupt or unreadable flag means "off": the safe direction is not
    // publishing something the clinic did not confirm.
    console.error("[gallery] could not read the enabled flag:", err);
    return false;
  }
}

export async function setGalleryEnabled(enabled: boolean, by: string): Promise<void> {
  await ensureSchema();
  const db = turso();
  await db.execute({
    sql: `INSERT INTO app_settings (id, data, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    args: ["gallery", JSON.stringify({ enabled: !!enabled }), Date.now()],
  });
  await auditEvent("gallery.enabled", `${enabled ? "on" : "off"} by ${by}`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read gallery media in display order.
 *
 * `includeHidden` is for the admin screen; the public site never passes it, so
 * an item switched off stays off for visitors. Read-only.
 */
export async function listGallery(includeHidden = false): Promise<GalleryItem[]> {
  await ensureSchema();
  const db = turso();
  const where = includeHidden ? "" : "WHERE visible = 1";
  // id is the final tiebreaker so two items sharing a position always come
  // back in the same order, rather than shuffling between page loads.
  const res = await db.execute(
    `SELECT * FROM gallery_items ${where} ORDER BY position ASC, created_at ASC, id ASC`,
  );
  return (res.rows as unknown as Array<Record<string, unknown>>).map(rowToItem);
}

/** How many items exist, hidden ones included. */
export async function galleryCount(): Promise<number> {
  await ensureSchema();
  const res = await turso().execute(`SELECT COUNT(*) AS c FROM gallery_items`);
  return Number((res.rows[0] as Record<string, unknown> | undefined)?.c ?? 0);
}

/** How many videos exist, hidden ones included. */
export async function galleryVideoCount(): Promise<number> {
  await ensureSchema();
  const res = await turso().execute(`SELECT COUNT(*) AS c FROM gallery_items WHERE kind = 'video'`);
  return Number((res.rows[0] as Record<string, unknown> | undefined)?.c ?? 0);
}

// ---------------------------------------------------------------------------
// Writes — each affects exactly one row
// ---------------------------------------------------------------------------

export type AddResult =
  | { ok: true; item: GalleryItem }
  | {
      ok: false;
      reason:
        | "not-configured"
        | "not-verified"
        | "not-found"
        | "too-large"
        | "bad-format"
        | "full"
        | "too-many-videos"
        | "duplicate";
      detail?: string;
    };

/**
 * Record media that has just been uploaded to Cloudinary.
 *
 * The upload itself already required a server-signed ticket, so the asset can
 * only be in the gallery folder. This step independently confirms with
 * Cloudinary what was actually stored before writing anything down. If the
 * asset breaks a rule it is removed from Cloudinary rather than left behind
 * consuming the quota.
 */
export async function addGalleryItem(input: {
  publicId: string;
  kind: MediaKind;
  caption: string;
  description: string;
  alt?: string;
  createdBy: string;
}): Promise<AddResult> {
  await ensureSchema();
  const db = turso();

  const publicId = input.publicId.trim();
  const kind: MediaKind = input.kind === "video" ? "video" : "image";
  if (!publicId) return { ok: false, reason: "not-found" };

  // Confine additions to the gallery folder, so a valid-looking id belonging
  // to some other part of the account cannot be pulled in.
  if (!publicId.startsWith(`${GALLERY_FOLDER}/`)) {
    return { ok: false, reason: "not-found", detail: "outside the gallery folder" };
  }

  const existing = await db.execute({
    sql: `SELECT id FROM gallery_items WHERE public_id = ?`,
    args: [publicId],
  });
  if (existing.rows.length > 0) return { ok: false, reason: "duplicate" };

  // A full gallery leaves the asset in place: that is the admin's decision to
  // resolve, not a reason to destroy something they just uploaded.
  if ((await galleryCount()) >= MAX_ITEMS) return { ok: false, reason: "full" };
  if (kind === "video" && (await galleryVideoCount()) >= MAX_VIDEOS) {
    return { ok: false, reason: "too-many-videos" };
  }

  // The authoritative description of the asset. Anything the client said
  // about size or format is ignored from here on.
  //
  // Retried briefly: an asset is occasionally not yet queryable through the
  // Admin API in the instant after its upload returns, and treating that
  // moment as "this file does not exist" would reject a perfectly good
  // upload. Three quick attempts, then give up honestly.
  let asset = await inspectAsset(publicId, kind);
  for (let attempt = 0; !asset && attempt < 2; attempt++) {
    await new Promise((r) => setTimeout(r, 400));
    asset = await inspectAsset(publicId, kind);
  }
  if (!asset) {
    // Distinguished from "not configured": the credentials may be perfectly
    // fine and the asset simply not findable. Conflating the two sends
    // whoever is debugging this to the wrong place entirely.
    const configured = cloudinaryConfigured();
    console.error(
      `[gallery] could not verify ${kind} "${publicId}" with Cloudinary` +
        (configured ? " (credentials are present)" : " — credentials are missing"),
    );
    return { ok: false, reason: configured ? "not-verified" : "not-configured" };
  }

  const allowed = kind === "video" ? ALLOWED_VIDEO_FORMATS : ALLOWED_IMAGE_FORMATS;
  if (!allowed.has(asset.format.toLowerCase())) {
    await destroyAsset(publicId, kind);
    return { ok: false, reason: "bad-format", detail: asset.format };
  }
  const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (asset.bytes > maxBytes) {
    await destroyAsset(publicId, kind);
    return { ok: false, reason: "too-large", detail: String(asset.bytes) };
  }

  const maxPos = await db.execute(`SELECT MAX(position) AS p FROM gallery_items`);
  const position = Number((maxPos.rows[0] as Record<string, unknown> | undefined)?.p ?? 0) + 1;

  const id = `gal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const caption = input.caption.slice(0, 200);
  // Alt text falls back to the caption so a screen reader is never handed an
  // unlabelled image just because the admin left the field blank.
  const alt = (input.alt?.trim() || caption || "Clinic gallery media").slice(0, 300);

  await db.execute({
    sql: `INSERT INTO gallery_items
            (id, public_id, url, alt, caption, description, width, height, bytes,
             format, kind, duration, position, visible, created_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [
      id,
      publicId,
      asset.secureUrl,
      alt,
      caption,
      input.description.slice(0, 500),
      asset.width,
      asset.height,
      asset.bytes,
      asset.format,
      kind,
      asset.duration,
      position,
      now,
      input.createdBy.slice(0, 120),
    ],
  });

  await auditEvent("gallery.add", `${id} ${kind} ${publicId} by ${input.createdBy}`);

  const row = await db.execute({ sql: `SELECT * FROM gallery_items WHERE id = ?`, args: [id] });
  return { ok: true, item: rowToItem(row.rows[0] as unknown as Record<string, unknown>) };
}

/**
 * Change an item's caption, description, alt text or visibility.
 *
 * Only these four fields are writable: the Cloudinary reference, the measured
 * size and the creation record cannot be edited through this path, so an edit
 * can never detach a row from the asset it describes.
 */
export async function updateGalleryItem(
  id: string,
  patch: { alt?: string; caption?: string; description?: string; visible?: boolean },
): Promise<boolean> {
  await ensureSchema();
  const db = turso();
  const cur = await db.execute({ sql: `SELECT * FROM gallery_items WHERE id = ?`, args: [id] });
  if (cur.rows.length === 0) return false;
  const item = rowToItem(cur.rows[0] as unknown as Record<string, unknown>);

  const caption = patch.caption === undefined ? item.caption : patch.caption.slice(0, 200);
  const description =
    patch.description === undefined ? item.description : patch.description.slice(0, 500);
  const alt =
    patch.alt === undefined
      ? item.alt
      : (patch.alt.trim() || caption || "Clinic gallery media").slice(0, 300);
  const visible = patch.visible === undefined ? item.visible : patch.visible;

  await db.execute({
    sql: `UPDATE gallery_items SET alt = ?, caption = ?, description = ?, visible = ? WHERE id = ?`,
    args: [alt, caption, description, visible ? 1 : 0, id],
  });
  await auditEvent("gallery.update", id);
  return true;
}

/**
 * Put items in a given order.
 *
 * Only reorders rows that already exist and are named in the list; ids that
 * are unknown are skipped, and items left out keep their current position.
 * It cannot create or remove anything.
 */
export async function reorderGallery(ids: string[]): Promise<number> {
  await ensureSchema();
  const db = turso();
  const known = await db.execute(`SELECT id FROM gallery_items`);
  const valid = new Set(
    (known.rows as unknown as Array<Record<string, unknown>>).map((r) => String(r.id)),
  );
  const stmts = ids
    .filter((id) => valid.has(id))
    .map((id, i) => ({
      sql: `UPDATE gallery_items SET position = ? WHERE id = ?`,
      args: [i + 1, id] as (string | number)[],
    }));
  if (stmts.length === 0) return 0;
  await db.batch(stmts, "write");
  await auditEvent("gallery.reorder", `${stmts.length} items`);
  return stmts.length;
}

/**
 * Remove one item: its row here and its asset in Cloudinary.
 *
 * Takes a single id and deletes by primary key, so there is no shape of input
 * that clears more than one row. The row is removed first and the asset
 * second — if the Cloudinary call fails the item has still left the site, and
 * a leftover asset is a quota nuisance rather than a visible fault.
 */
export async function deleteGalleryItem(id: string, by: string): Promise<boolean> {
  await ensureSchema();
  const db = turso();
  const cur = await db.execute({
    sql: `SELECT public_id, kind FROM gallery_items WHERE id = ?`,
    args: [id],
  });
  if (cur.rows.length === 0) return false;
  const row = cur.rows[0] as Record<string, unknown>;
  const publicId = String(row.public_id ?? "");
  const kind: MediaKind = String(row.kind ?? "image") === "video" ? "video" : "image";

  await db.execute({ sql: `DELETE FROM gallery_items WHERE id = ?`, args: [id] });
  await auditEvent("gallery.delete", `${id} ${publicId} by ${by}`);

  if (publicId) await destroyAsset(publicId, kind);
  return true;
}
