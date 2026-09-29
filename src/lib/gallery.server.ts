/**
 * Clinic gallery — storage layer.
 *
 * WHERE THE PHOTOS LIVE
 *
 * The image bytes live in Cloudinary; this table holds only a reference to
 * each one plus its caption, order and visibility. Nothing here stores or
 * reads patient data.
 *
 * WHY GALLERY ROWS CANNOT BE WIPED BY A SYNC
 *
 * syncState() reconciles six tables against what the browser sends, and
 * gallery_items is not one of them. A client sync therefore has no way to
 * touch a gallery row even if it tried: there is no code path from the sync
 * payload to this table. Every change comes through an explicit, individually
 * authenticated call below, and each one affects exactly one row.
 *
 * WHY LIMITS ARE CHECKED AGAINST CLOUDINARY, NOT THE BROWSER
 *
 * A browser can claim any size and format it likes. addGalleryItem() ignores
 * what it was told and asks Cloudinary what the asset actually is; an image
 * that breaks the rules is deleted from Cloudinary and never recorded. An
 * asset Cloudinary cannot confirm is likewise never recorded.
 */

import { turso, auditEvent } from "./turso.server";
import { ensureSchema } from "./schema.server";
import { inspectAsset, destroyAsset } from "./cloudinary.server";

/** Folder every gallery asset is confined to. */
export const GALLERY_FOLDER = "sthairya/gallery";

/** Per-image ceiling, enforced against Cloudinary's reported byte count. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Ceiling on how many photos the gallery can hold.
 *
 * Not a storage limit — storage is nowhere near the constraint. It is a
 * delivery-bandwidth guard: the free Cloudinary tier shares one monthly
 * allowance between storage, transformations and bandwidth, and a carousel
 * that loads every photo on every homepage view is what would exhaust it.
 */
export const MAX_ITEMS = 60;

const ALLOWED_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);

export interface GalleryItem {
  id: string;
  publicId: string;
  url: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
  position: number;
  visible: boolean;
  createdAt: number;
  createdBy: string;
}

function rowToItem(r: Record<string, unknown>): GalleryItem {
  return {
    id: String(r.id ?? ""),
    publicId: String(r.public_id ?? ""),
    url: String(r.url ?? ""),
    alt: String(r.alt ?? ""),
    caption: String(r.caption ?? ""),
    width: Number(r.width ?? 0),
    height: Number(r.height ?? 0),
    bytes: Number(r.bytes ?? 0),
    format: String(r.format ?? ""),
    position: Number(r.position ?? 0),
    visible: Number(r.visible ?? 0) === 1,
    createdAt: Number(r.created_at ?? 0),
    createdBy: String(r.created_by ?? ""),
  };
}

/**
 * Read gallery photos in display order.
 *
 * `includeHidden` is for the admin screen; the public site never passes it, so
 * a photo switched off stays off for visitors. Read-only.
 */
export async function listGallery(includeHidden = false): Promise<GalleryItem[]> {
  await ensureSchema();
  const db = turso();
  const where = includeHidden ? "" : "WHERE visible = 1";
  // id is the final tiebreaker so two photos sharing a position always come
  // back in the same order, rather than shuffling between page loads.
  const res = await db.execute(
    `SELECT * FROM gallery_items ${where} ORDER BY position ASC, created_at ASC, id ASC`,
  );
  return (res.rows as unknown as Array<Record<string, unknown>>).map(rowToItem);
}

/** How many photos exist, hidden ones included. */
export async function galleryCount(): Promise<number> {
  await ensureSchema();
  const res = await turso().execute(`SELECT COUNT(*) AS c FROM gallery_items`);
  return Number((res.rows[0] as Record<string, unknown> | undefined)?.c ?? 0);
}

export type AddResult =
  | { ok: true; item: GalleryItem }
  | {
      ok: false;
      reason: "not-configured" | "not-found" | "too-large" | "bad-format" | "full" | "duplicate";
      detail?: string;
    };

/**
 * Record a photo that has just been uploaded to Cloudinary.
 *
 * The upload itself already required a server-signed ticket, so the asset can
 * only be in the gallery folder. This step independently confirms with
 * Cloudinary what was actually stored before writing anything down. If the
 * asset breaks a rule it is removed from Cloudinary rather than left behind
 * consuming the quota.
 */
export async function addGalleryItem(input: {
  publicId: string;
  alt: string;
  caption: string;
  createdBy: string;
}): Promise<AddResult> {
  await ensureSchema();
  const db = turso();

  const publicId = input.publicId.trim();
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

  if ((await galleryCount()) >= MAX_ITEMS) {
    // Leave the asset in place rather than deleting it: the gallery being
    // full is the admin's decision to resolve, not a reason to destroy an
    // image they just uploaded.
    return { ok: false, reason: "full" };
  }

  // The authoritative description of the asset. Anything the client said
  // about size or format is ignored from here on.
  const asset = await inspectAsset(publicId);
  if (!asset) return { ok: false, reason: "not-configured" };

  if (!ALLOWED_FORMATS.has(asset.format.toLowerCase())) {
    await destroyAsset(publicId);
    return { ok: false, reason: "bad-format", detail: asset.format };
  }
  if (asset.bytes > MAX_IMAGE_BYTES) {
    await destroyAsset(publicId);
    return { ok: false, reason: "too-large", detail: String(asset.bytes) };
  }

  const maxPos = await db.execute(`SELECT MAX(position) AS p FROM gallery_items`);
  const position = Number((maxPos.rows[0] as Record<string, unknown> | undefined)?.p ?? 0) + 1;

  const id = `gal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  await db.execute({
    sql: `INSERT INTO gallery_items
            (id, public_id, url, alt, caption, width, height, bytes, format,
             position, visible, created_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    args: [
      id,
      publicId,
      asset.secureUrl,
      input.alt.slice(0, 300),
      input.caption.slice(0, 500),
      asset.width,
      asset.height,
      asset.bytes,
      asset.format,
      position,
      now,
      input.createdBy.slice(0, 120),
    ],
  });

  await auditEvent("gallery.add", `${id} ${publicId} by ${input.createdBy}`);

  const row = await db.execute({ sql: `SELECT * FROM gallery_items WHERE id = ?`, args: [id] });
  return { ok: true, item: rowToItem(row.rows[0] as unknown as Record<string, unknown>) };
}

/**
 * Change a photo's caption, alt text or visibility.
 *
 * Only these three fields are writable: the Cloudinary reference, the
 * measured size and the creation record cannot be edited through this path,
 * so an edit can never detach a row from the asset it describes.
 */
export async function updateGalleryItem(
  id: string,
  patch: { alt?: string; caption?: string; visible?: boolean },
): Promise<boolean> {
  await ensureSchema();
  const db = turso();
  const cur = await db.execute({ sql: `SELECT * FROM gallery_items WHERE id = ?`, args: [id] });
  if (cur.rows.length === 0) return false;
  const item = rowToItem(cur.rows[0] as unknown as Record<string, unknown>);

  const alt = patch.alt === undefined ? item.alt : patch.alt.slice(0, 300);
  const caption = patch.caption === undefined ? item.caption : patch.caption.slice(0, 500);
  const visible = patch.visible === undefined ? item.visible : patch.visible;

  await db.execute({
    sql: `UPDATE gallery_items SET alt = ?, caption = ?, visible = ? WHERE id = ?`,
    args: [alt, caption, visible ? 1 : 0, id],
  });
  await auditEvent("gallery.update", id);
  return true;
}

/**
 * Put photos in a given order.
 *
 * Only reorders rows that already exist and are named in the list; ids that
 * are unknown are skipped, and photos left out keep their current position.
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
 * Remove one photo: its row here and its asset in Cloudinary.
 *
 * Takes a single id and deletes by primary key, so there is no shape of input
 * that clears more than one row. The row is removed first and the asset
 * second — if the Cloudinary call fails the photo has still left the site,
 * and a leftover asset is a quota nuisance rather than a visible fault.
 */
export async function deleteGalleryItem(id: string, by: string): Promise<boolean> {
  await ensureSchema();
  const db = turso();
  const cur = await db.execute({
    sql: `SELECT public_id FROM gallery_items WHERE id = ?`,
    args: [id],
  });
  if (cur.rows.length === 0) return false;
  const publicId = String((cur.rows[0] as Record<string, unknown>).public_id ?? "");

  await db.execute({ sql: `DELETE FROM gallery_items WHERE id = ?`, args: [id] });
  await auditEvent("gallery.delete", `${id} ${publicId} by ${by}`);

  if (publicId) await destroyAsset(publicId);
  return true;
}
