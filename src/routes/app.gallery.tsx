import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/session";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Play, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gallery management — admin only.
 *
 * The role check below hides the screen, but it is NOT what protects the
 * data: every call made here carries the signed session token, and the server
 * verifies it independently. Someone who calls those endpoints directly gets
 * nowhere, which is the point — a check that lives only in the browser
 * protects nothing.
 *
 * UPLOADS DO NOT PASS THROUGH THIS SITE
 *
 * The file goes straight from the browser to Cloudinary using a one-shot
 * ticket the server signs. Nothing large ever reaches our own server or the
 * database: only a pointer is recorded afterwards, once the server has asked
 * Cloudinary what was actually stored.
 */

export const Route = createFileRoute("/app/gallery")({
  component: GalleryAdmin,
});

interface AdminItem {
  id: string;
  kind: "image" | "video";
  thumbUrl: string;
  posterUrl: string;
  alt: string;
  caption: string;
  description: string;
  bytes: number;
  visible: boolean;
}

const MAX_IMAGE_MB = 2;
const MAX_VIDEO_MB = 15;

function prettyBytes(n: number): string {
  if (n <= 0) return "";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

function GalleryAdmin() {
  const { hasRole } = useAuth();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const { fetchGalleryAdmin } = await import("@/lib/db.functions");
      const res = await fetchGalleryAdmin({ data: { token: getAuthToken() ?? "" } });
      if (!res.ok) {
        // The one failure worth explaining precisely: everything works except
        // the server cannot verify who is calling.
        if (res.reason === "forbidden") {
          toast.error("Your session could not be verified. Please sign out and sign in again.");
        } else {
          toast.error("Could not load the gallery.");
        }
        setItems([]);
        return;
      }
      setItems((res.items ?? []) as AdminItem[]);
      setEnabled(res.enabled === true);
    } catch {
      toast.error("Could not load the gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!hasRole("admin")) {
    return <div className="text-center py-20 text-muted-foreground">Admins only.</div>;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // The input is reset immediately so picking the same file twice in a row
    // still fires a change event.
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const kind: "image" | "video" = isVideo ? "video" : "image";
    const limitMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;

    // Checked here purely so an oversized file fails instantly instead of
    // after a long upload. The server checks again against what Cloudinary
    // actually received, and that check is the one that counts.
    if (file.size > limitMb * 1024 * 1024) {
      toast.error(`${isVideo ? "Videos" : "Images"} must be under ${limitMb} MB.`);
      return;
    }
    if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime))$/.test(file.type)) {
      toast.error("Use a JPG, PNG or WebP image, or an MP4, WebM or MOV video.");
      return;
    }

    setBusy(true);
    setUploadPct(0);
    try {
      const { galleryUploadTicket, galleryAdd } = await import("@/lib/db.functions");
      const token = getAuthToken() ?? "";

      const t = await galleryUploadTicket({ data: { token, kind } });
      if (!t.ok) {
        toast.error(
          t.reason === "forbidden"
            ? "Your session could not be verified. Please sign out and sign in again."
            : t.reason === "full"
              ? "The gallery is full. Remove something first."
              : t.reason === "too-many-videos"
                ? "The video limit has been reached. Remove a video first."
                : "Uploads are not configured yet.",
        );
        return;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("api_key", t.ticket.apiKey);
      form.append("signature", t.ticket.signature);
      for (const [k, v] of Object.entries(t.ticket.params)) form.append(k, String(v));

      const uploaded = await uploadWithProgress(t.ticket.uploadUrl, form, setUploadPct);

      // Cloudinary's own answer for where the asset landed. Predicting it
      // would mean assuming which folder mode this account uses, and a wrong
      // guess makes the server's verification miss a file that uploaded
      // perfectly well. The expected id is the fallback, not the source.
      const publicId = uploaded.public_id || t.publicId;

      const added = await galleryAdd({
        data: { token, publicId, kind, caption, description },
      });
      if (!added.ok) {
        toast.error(
          added.reason === "too-large"
            ? `That file was over the ${limitMb} MB limit and was discarded.`
            : added.reason === "bad-format"
              ? "That file type is not allowed."
              : added.reason === "duplicate"
                ? "That file is already in the gallery."
                : added.reason === "not-verified"
                  ? "The file uploaded, but it could not be confirmed with Cloudinary. Please try again."
                  : added.reason === "not-configured"
                    ? "Cloudinary is not configured on the server."
                    : added.reason === "not-found"
                      ? "The upload landed outside the gallery folder and was not saved."
                      : "The upload could not be saved.",
        );
        console.error("[gallery admin] could not record upload:", added.reason, publicId);
        return;
      }
      setCaption("");
      setDescription("");
      toast.success(isVideo ? "Video added." : "Photo added.");
      await refresh();
    } catch (err) {
      console.error("[gallery admin] upload failed:", err);
      // Cloudinary explains its own refusals precisely ("Invalid Signature",
      // "File size too large", and so on). Swallowing that behind "please try
      // again" turns a fixable problem into a mystery, so it is shown.
      const detail = err instanceof Error ? err.message : "";
      toast.error(detail ? `Upload failed - ${detail}` : "The upload failed. Please try again.");
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  }

  async function toggleEnabled(next: boolean) {
    setBusy(true);
    try {
      const { gallerySetEnabled } = await import("@/lib/db.functions");
      const res = await gallerySetEnabled({ data: { token: getAuthToken() ?? "", enabled: next } });
      if (!res.ok) {
        toast.error("Could not change that.");
        return;
      }
      setEnabled(next);
      toast.success(next ? "Gallery is now live on the website." : "Gallery hidden from visitors.");
    } finally {
      setBusy(false);
    }
  }

  async function setVisible(id: string, visible: boolean) {
    const { galleryUpdate } = await import("@/lib/db.functions");
    const res = await galleryUpdate({ data: { token: getAuthToken() ?? "", id, visible } });
    if (!res.ok) return toast.error("Could not update that item.");
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, visible } : i)));
  }

  async function saveText(id: string, next: { caption: string; description: string }) {
    const { galleryUpdate } = await import("@/lib/db.functions");
    const res = await galleryUpdate({ data: { token: getAuthToken() ?? "", id, ...next } });
    if (!res.ok) return toast.error("Could not save that.");
    setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...next } : i)));
    toast.success("Saved.");
  }

  async function remove(id: string) {
    // Deleting removes the file from Cloudinary too, so it is worth one
    // confirmation — this is the only irreversible action on the screen.
    if (!window.confirm("Remove this from the gallery? This also deletes the file.")) return;
    const { galleryDelete } = await import("@/lib/db.functions");
    const res = await galleryDelete({ data: { token: getAuthToken() ?? "", id } });
    if (!res.ok) return toast.error("Could not remove that item.");
    setItems((cur) => cur.filter((i) => i.id !== id));
    toast.success("Removed.");
  }

  async function move(index: number, delta: number) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    const { galleryReorder } = await import("@/lib/db.functions");
    const res = await galleryReorder({
      data: { token: getAuthToken() ?? "", ids: next.map((i) => i.id) },
    });
    if (!res.ok) {
      toast.error("Could not save the new order.");
      await refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gallery</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Photos and short clips shown on the public Gallery page. Files are stored outside the
          clinic database - only a reference is kept here.
        </p>
      </div>

      {/* Master switch */}
      <div className="rounded-xl border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-medium">Show the gallery on the website</div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {enabled
              ? "Visitors can see the Gallery page and its link in the menu."
              : "The Gallery page and its menu link are hidden from visitors."}
          </p>
        </div>
        <Button
          type="button"
          disabled={busy || loading}
          onClick={() => void toggleEnabled(!enabled)}
          className={cn(!enabled && "brand-gradient text-white border-0")}
          variant={enabled ? "outline" : "default"}
        >
          {enabled ? "Turn off" : "Turn on"}
        </Button>
      </div>

      {/* Upload */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="font-medium">Add a photo or clip</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gal-caption">Caption</Label>
            <Input
              id="gal-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Treatment room"
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gal-desc">Short description</Label>
            <Input
              id="gal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Where one-to-one sessions take place"
              maxLength={500}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => void onPick(e)}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="brand-gradient text-white border-0"
          >
            {busy ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Upload className="size-4 mr-2" />
            )}
            {busy ? "Uploading…" : "Choose file"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Images up to {MAX_IMAGE_MB} MB (JPG, PNG, WebP) · Videos up to {MAX_VIDEO_MB} MB (MP4,
            WebM, MOV)
          </span>
        </div>
        {uploadPct !== null && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-brand transition-[width] duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Items */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading gallery…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Nothing in the gallery yet. Add your first photo above.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <Row
              key={item.id}
              item={item}
              first={i === 0}
              last={i === items.length - 1}
              onMoveUp={() => void move(i, -1)}
              onMoveDown={() => void move(i, 1)}
              onToggle={() => void setVisible(item.id, !item.visible)}
              onRemove={() => void remove(item.id)}
              onSave={(next) => void saveText(item.id, next)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  item,
  first,
  last,
  onMoveUp,
  onMoveDown,
  onToggle,
  onRemove,
  onSave,
}: {
  item: AdminItem;
  first: boolean;
  last: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onRemove: () => void;
  onSave: (next: { caption: string; description: string }) => void;
}) {
  const [caption, setCaption] = useState(item.caption);
  const [description, setDescription] = useState(item.description);
  const dirty = caption !== item.caption || description !== item.description;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 flex flex-col sm:flex-row gap-4",
        !item.visible && "opacity-60",
      )}
    >
      <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        <img
          src={item.kind === "video" ? item.posterUrl || item.thumbUrl : item.thumbUrl}
          alt={item.alt}
          className="size-full object-cover"
          loading="lazy"
        />
        {item.kind === "video" && (
          <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-black/60 text-white">
            <Play className="size-2.5 fill-current" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption"
          maxLength={200}
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          maxLength={500}
        />
        <div className="text-xs text-muted-foreground">
          {item.kind === "video" ? "Video" : "Photo"}
          {item.bytes > 0 && ` · ${prettyBytes(item.bytes)}`}
          {!item.visible && " · hidden from the website"}
        </div>
      </div>

      <div className="flex sm:flex-col items-center gap-1.5 shrink-0">
        {dirty && (
          <Button size="sm" onClick={() => onSave({ caption, description })}>
            Save
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          onClick={onToggle}
          title={item.visible ? "Hide from the website" : "Show on the website"}
          aria-label={item.visible ? "Hide from the website" : "Show on the website"}
        >
          {item.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={onMoveUp}
          disabled={first}
          title="Move up"
          aria-label="Move up"
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={onMoveDown}
          disabled={last}
          title="Move down"
          aria-label="Move down"
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={onRemove}
          title="Remove"
          aria-label="Remove"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * POST a file to Cloudinary with a progress readout.
 *
 * XMLHttpRequest rather than fetch purely because it reports upload progress;
 * fetch still cannot, and a video upload with no feedback looks like a hung
 * page.
 */
function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<{ public_id?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      // Cloudinary returns JSON on success and on failure alike, and the
      // failure body carries the reason. Parsed either way so the reason can
      // be reported instead of a bare status code.
      let body: { public_id?: string; error?: { message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON response; fall back to the status line below */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
        return;
      }
      reject(new Error(body.error?.message || `Cloudinary responded ${xhr.status}`.slice(0, 300)));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(form);
  });
}
