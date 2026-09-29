import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The gallery wall: rows of images and short looping clips that slide
 * sideways, with adjacent rows travelling in opposite directions.
 *
 * MOTION
 *
 * Each row renders its items twice and slides by exactly half its own width,
 * so the second copy arrives where the first began and the loop has no
 * visible seam. Odd rows run the same animation in reverse, which is what
 * produces the counter-drift.
 *
 * A row holding only a few photos would be narrower than the frame and would
 * drag a gap across it, so each half repeats its items until there is enough
 * to fill. Both halves repeat identically, which is what keeps the loop
 * seamless.
 *
 * The slide only ever stops for a pointer: hovering, touching or
 * keyboard-focusing any card pauses every row at once, not just the one under
 * the finger — a card that stops while its neighbours keep moving reads as a
 * glitch, and the point of the pause is to let someone look at the thing they
 * reached for.
 *
 * BACKGROUND
 *
 * The wall paints no background of its own: the page's own gradient shows
 * through. The edges are softened with a CSS mask rather than a gradient
 * overlay, because an overlay has to be painted in some colour and the page
 * behind it is a three-layer gradient that no flat colour can match. A mask
 * fades the cards themselves to transparent, so it is correct over any
 * background, in either theme.
 *
 * CAPTIONS
 *
 * The caption is always on screen. It used to appear on hover, which meant it
 * was invisible on every phone and tablet, where no hover exists. The longer
 * description is the part that waits for a hover, and on a touch device it is
 * reached by tapping the photo, which opens the viewer.
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

/** A single item cannot slide against itself convincingly; it sits still. */
const MIN_ITEMS_TO_ANIMATE = 2;

/** Cards each half of a row aims for before it is wide enough to fill the frame. */
const FILL_TARGET = 8;

/** Seconds per full loop, per row. Deliberately slow, and varied so the rows
 *  never fall into lockstep with each other. */
const ROW_SECONDS = [72, 88, 80];

/** Fades the first and last few percent of each row to transparent. Works over
 *  any background because it removes pixels rather than painting over them. */
const EDGE_MASK = "linear-gradient(to right, transparent 0, #000 7%, #000 93%, transparent 100%)";

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

export function GalleryWall({ items }: { items: GalleryMedia[] }) {
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState(3);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Fewer rows on a phone, where three bands of small photos would leave each
  // one too short to see.
  useEffect(() => {
    const decide = () => setRowCount(window.innerWidth >= 640 ? 3 : 2);
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

  const rows = useMemo(() => {
    const out: GalleryMedia[][] = Array.from({ length: rowCount }, () => []);
    items.forEach((it, i) => out[i % rowCount].push(it));
    return out;
  }, [items, rowCount]);

  const animate = items.length >= MIN_ITEMS_TO_ANIMATE && !reducedMotion;

  // Position within the ORIGINAL list, so the viewer's next/previous walk the
  // gallery in its real order rather than the shuffled row order.
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [items]);

  return (
    <>
      <style>{`
        @keyframes sth-gallery-left  { from { transform: translateX(0); }    to { transform: translateX(-50%); } }
        @keyframes sth-gallery-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
      `}</style>

      {/* No background of its own — the page's gradient shows through. */}
      <div className="flex flex-col gap-4">
        {rows.map((row, ri) => {
          // Repeat the row until one half is wide enough to fill the frame;
          // both halves repeat identically so the loop stays seamless.
          const reps = row.length ? Math.max(1, Math.ceil(FILL_TARGET / row.length)) : 1;
          const half = animate ? Array.from({ length: reps }, () => row).flat() : row;

          return (
            <div
              key={ri}
              className="overflow-hidden h-44 sm:h-52 lg:h-60"
              style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
            >
              <div
                className={cn("flex gap-4 h-full w-max will-change-transform")}
                style={
                  animate
                    ? {
                        animationName: ri % 2 === 0 ? "sth-gallery-left" : "sth-gallery-right",
                        animationDuration: `${ROW_SECONDS[ri % ROW_SECONDS.length]}s`,
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
                      // Only the very first appearance of each item is real to
                      // assistive technology; the repeats exist purely to make
                      // the loop seamless and would otherwise be read out over
                      // and over.
                      duplicate={!(copy === 0 && i < row.length)}
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
  // Aspect ratio comes from the real dimensions, so a portrait photo stays a
  // narrow card and a landscape one a wide card at the same row height. That
  // unevenness is what makes it a bento wall rather than a row of identical
  // tiles.
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
      // Touch gets the same pause as a cursor. onTouchStart fires as the finger
      // lands, before any tap is resolved, so the wall stops the instant it is
      // touched rather than only once something is opened.
      onTouchStart={() => onHoverChange(true)}
      onTouchEnd={() => onHoverChange(false)}
      onTouchCancel={() => onHoverChange(false)}
      aria-hidden={duplicate ? "true" : undefined}
      tabIndex={duplicate ? -1 : 0}
      className={cn(
        "group relative h-full shrink-0 overflow-hidden rounded-2xl cursor-pointer",
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
          className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm"
        >
          <Play className="size-3 fill-current" />
        </span>
      )}

      {(item.caption || item.description) && (
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 p-2.5 text-left",
            // Sits over the photograph itself, so it stays dark regardless of
            // the page behind it — that is what keeps the text readable on any
            // image.
            "bg-gradient-to-t from-black/85 via-black/45 to-transparent",
          )}
        >
          {item.caption && (
            <span className="block text-[13px] font-semibold text-white leading-snug line-clamp-2">
              {item.caption}
            </span>
          )}
          {item.description && (
            <span
              className={cn(
                "block text-[11px] text-white/80 leading-snug",
                // The description is the part that waits for a hover. On a
                // touch device there is no hover, so tapping the photo opens
                // the viewer, which shows it in full.
                "max-h-0 overflow-hidden opacity-0",
                "transition-all duration-300 ease-out",
                "group-hover:mt-1 group-hover:max-h-16 group-hover:opacity-100",
                "group-focus-visible:mt-1 group-focus-visible:max-h-16 group-focus-visible:opacity-100",
              )}
            >
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
