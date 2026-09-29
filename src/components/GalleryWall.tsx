import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The gallery wall: a bento/masonry of images and short looping clips that
 * slides continuously, with adjacent columns moving in opposite directions.
 *
 * MOTION
 *
 * Each column renders its items twice and slides by exactly half its own
 * height, so the second copy arrives where the first began and the loop has no
 * visible seam. Odd columns run the same animation in reverse, which is what
 * produces the organic counter-drift.
 *
 * A column with only one or two photos would be shorter than the frame and
 * would leave a gap scrolling through it, so each half repeats its items until
 * there is enough to fill. Both halves repeat identically, which is what keeps
 * the loop seamless.
 *
 * The slide only ever stops for a pointer: hovering, touching or
 * keyboard-focusing any card pauses every column at once, not just the one
 * under the finger — a card that stops while its neighbours keep moving reads
 * as a glitch, and the point of the pause is to let someone look at the thing
 * they reached for.
 *
 * The animation is CSS, so it runs on the compositor and costs nothing per
 * frame. It is switched off for anyone whose system asks for reduced motion.
 *
 * COLOUR
 *
 * The wall sits on the same --surface the rest of the site uses for panels, so
 * it reads as part of the page. Both tokens here are theme-aware, so this
 * follows dark mode on its own rather than imposing a dark block of its own.
 */

export interface GalleryMedia {
  id: string;
  kind: "image" | "video";
  url: string;
  thumbUrl: string;
  posterUrl: string;
  /** Untransformed URL, used when a transformed one will not load. */
  originalUrl?: string;
  alt: string;
  caption: string;
  description: string;
  width: number;
  height: number;
}

/**
 * Show a transformed URL, but fall back to the original if it will not load.
 *
 * The transformed URLs are built by rewriting the one Cloudinary gave us, and
 * an account with strict transformations enabled serves the original while
 * refusing every derived version — which reaches the page as nothing more
 * informative than a broken image. Falling back keeps the gallery working
 * whatever that account setting happens to be; the transformation is a
 * bandwidth saving, not something worth showing a broken photo over.
 */
function useSrcWithFallback(preferred: string, original?: string) {
  const [src, setSrc] = useState(preferred || original || "");
  const [failed, setFailed] = useState(false);

  // A different item can land in the same rendered slot, so the source has to
  // follow the item rather than stay where the first render left it.
  useEffect(() => {
    setSrc(preferred || original || "");
    setFailed(false);
  }, [preferred, original]);

  const onError = useCallback(() => {
    if (original && src !== original) setSrc(original);
    else setFailed(true);
  }, [original, src]);

  return { src, failed, onError };
}

/** A single item cannot slide against itself convincingly; it sits still. */
const MIN_ITEMS_TO_ANIMATE = 2;

/** Items each half of a column aims for before it is tall enough to fill the frame. */
const FILL_TARGET = 5;

/** Seconds per full loop, per column. Deliberately slow, and varied so the
 *  columns never fall into lockstep with each other. */
const COLUMN_SECONDS = [64, 78, 70, 86];

export function GalleryWall({ items }: { items: GalleryMedia[] }) {
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [columnCount, setColumnCount] = useState(3);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Column count follows the viewport: four columns on a phone would make
  // every card a postage stamp.
  useEffect(() => {
    const decide = () => {
      const w = window.innerWidth;
      setColumnCount(w >= 1024 ? 4 : w >= 640 ? 3 : 2);
    };
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const columns = useMemo(() => {
    const cols: GalleryMedia[][] = Array.from({ length: columnCount }, () => []);
    items.forEach((it, i) => cols[i % columnCount].push(it));
    return cols;
  }, [items, columnCount]);

  const animate = items.length >= MIN_ITEMS_TO_ANIMATE && !reducedMotion;

  // Position within the ORIGINAL list, so the lightbox's next/previous walk
  // the gallery in its real order rather than the shuffled column order.
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [items]);

  return (
    <>
      <style>{`
        @keyframes sth-gallery-up   { from { transform: translateY(0); }      to { transform: translateY(-50%); } }
        @keyframes sth-gallery-down { from { transform: translateY(-50%); }   to { transform: translateY(0); } }
      `}</style>

      <div
        className={cn(
          "relative overflow-hidden rounded-3xl",
          // The site's own panel surface, the same one used elsewhere on the
          // public pages — not a dark block dropped into a light page.
          "bg-surface border soft-shadow",
          "px-4 py-4 sm:px-5 sm:py-5",
        )}
      >
        {/* Soft fades so cards enter and leave the wall rather than being
            sliced off by a hard edge. Drawn from the panel's own colour. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-surface to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-surface to-transparent"
        />

        <div
          className="grid gap-4 h-[72vh] min-h-[520px] max-h-[860px]"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {columns.map((col, ci) => {
            // Repeat the column until one half is tall enough to fill the
            // frame; both halves repeat identically so the loop stays seamless.
            const reps = col.length ? Math.max(1, Math.ceil(FILL_TARGET / col.length)) : 1;
            const half = animate ? Array.from({ length: reps }, () => col).flat() : col;

            return (
              <div key={ci} className="overflow-hidden">
                <div
                  className="flex flex-col gap-4 will-change-transform"
                  style={
                    animate
                      ? {
                          animationName: ci % 2 === 0 ? "sth-gallery-up" : "sth-gallery-down",
                          animationDuration: `${COLUMN_SECONDS[ci % COLUMN_SECONDS.length]}s`,
                          animationTimingFunction: "linear",
                          animationIterationCount: "infinite",
                          animationPlayState: paused ? "paused" : "running",
                        }
                      : undefined
                  }
                >
                  {(animate ? [0, 1] : [0]).map((copy) =>
                    half.map((item, i) => (
                      <Card
                        key={`${item.id}-${copy}-${i}`}
                        item={item}
                        // Only the very first appearance of each item is real
                        // to assistive technology; the repeats exist purely to
                        // make the loop seamless and would otherwise be read
                        // out over and over.
                        duplicate={!(copy === 0 && i < col.length)}
                        onHoverChange={setPaused}
                        onOpen={() => setLightbox(indexById.get(item.id) ?? 0)}
                      />
                    )),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lightbox !== null && lightbox >= 0 && (
        <Lightbox
          items={items}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onMove={setLightbox}
        />
      )}
    </>
  );
}

function Card({
  item,
  duplicate,
  onHoverChange,
  onOpen,
}: {
  item: GalleryMedia;
  duplicate: boolean;
  onHoverChange: (v: boolean) => void;
  onOpen: () => void;
}) {
  // Aspect ratio comes from the real dimensions, so portrait stays portrait
  // and landscape stays landscape — that unevenness is what makes it a bento
  // wall rather than a grid of identical tiles.
  const ratio = item.width > 0 && item.height > 0 ? item.width / item.height : 4 / 3;
  const media = useSrcWithFallback(
    item.kind === "video" ? item.url : item.thumbUrl,
    item.originalUrl,
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      // Touch gets the same pause as a cursor. onTouchStart fires as the
      // finger lands, before any tap is resolved, so the wall stops the
      // instant it is touched rather than only once something is opened.
      onTouchStart={() => onHoverChange(true)}
      onTouchEnd={() => onHoverChange(false)}
      onTouchCancel={() => onHoverChange(false)}
      aria-hidden={duplicate ? "true" : undefined}
      tabIndex={duplicate ? -1 : 0}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl cursor-pointer",
        "bg-card border",
        "transition-[transform,box-shadow] duration-300 ease-out",
        "hover:scale-[1.03] hover:shadow-xl hover:shadow-foreground/15",
        "focus:outline-none focus-visible:scale-[1.03] focus-visible:ring-2 focus-visible:ring-brand",
      )}
      style={{ aspectRatio: String(ratio) }}
    >
      {media.failed ? (
        // Never a broken-image icon: a tile carrying its own caption still
        // reads as part of the gallery, where a torn-page glyph reads as a
        // broken site.
        <span className="absolute inset-0 grid place-items-center bg-muted px-4 text-center">
          <span className="text-xs text-muted-foreground">{item.caption || item.alt}</span>
        </span>
      ) : item.kind === "video" ? (
        <video
          src={media.src}
          poster={item.posterUrl || undefined}
          // Silent, looping and inline: the three conditions every browser
          // requires before it will start a video without a user gesture.
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={item.alt}
          onError={media.onError}
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          src={media.src}
          alt={duplicate ? "" : item.alt}
          loading="lazy"
          decoding="async"
          onError={media.onError}
          className="h-full w-full object-cover"
        />
      )}

      {item.kind === "video" && (
        <span
          aria-hidden="true"
          className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"
        >
          <Play className="size-3.5 fill-current" />
        </span>
      )}

      {(item.caption || item.description) && (
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 p-3 text-left",
            // Sits over the photograph itself, so it stays dark regardless of
            // the panel behind it — that is what keeps the text readable on
            // any image.
            "bg-gradient-to-t from-black/80 via-black/40 to-transparent",
            "opacity-0 translate-y-1 transition-all duration-300",
            "group-hover:opacity-100 group-hover:translate-y-0",
            "group-focus-visible:opacity-100 group-focus-visible:translate-y-0",
          )}
        >
          {item.caption && (
            <span className="block text-sm font-semibold text-white leading-snug">
              {item.caption}
            </span>
          )}
          {item.description && (
            <span className="mt-0.5 block text-xs text-white/75 leading-snug line-clamp-2">
              {item.description}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  onMove,
}: {
  items: GalleryMedia[];
  index: number;
  onClose: () => void;
  onMove: (i: number) => void;
}) {
  const item = items[index];
  // Hooks must run on every render, so this is read before the early return
  // below; `item` can be undefined for one render while the index moves.
  const full = useSrcWithFallback(item?.url ?? "", item?.originalUrl);

  const prev = useCallback(
    () => onMove((index - 1 + items.length) % items.length),
    [index, items.length, onMove],
  );
  const next = useCallback(() => onMove((index + 1) % items.length), [index, items.length, onMove]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while a full-screen overlay is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption || "Gallery item"}
      // A viewer is a different surface from a page: dimming everything behind
      // it is what lets a single photograph be looked at properly, and it is
      // what every image viewer does.
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/95 backdrop-blur-sm p-4 sm:p-8"
      // Clicking the backdrop closes; clicking the media itself does not,
      // which is why the inner wrapper stops the event.
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-background/15 text-background hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background transition-colors"
      >
        <X className="size-5" />
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous"
            className="absolute left-2 sm:left-5 grid size-11 place-items-center rounded-full bg-background/15 text-background hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background transition-colors"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next"
            className="absolute right-2 sm:right-5 grid size-11 place-items-center rounded-full bg-background/15 text-background hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background transition-colors"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      )}

      <div
        className="max-w-5xl w-full max-h-full flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === "video" ? (
          <video
            src={full.src}
            poster={item.posterUrl || undefined}
            controls
            autoPlay
            loop
            muted
            playsInline
            onError={full.onError}
            className="max-h-[75vh] w-auto max-w-full rounded-xl"
          />
        ) : (
          <img
            src={full.src}
            alt={item.alt}
            onError={full.onError}
            className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain"
          />
        )}

        {(item.caption || item.description) && (
          <div className="text-center max-w-2xl">
            {item.caption && (
              <h2 className="text-base font-semibold text-background">{item.caption}</h2>
            )}
            {item.description && (
              <p className="mt-1 text-sm text-background/70 leading-relaxed">{item.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
