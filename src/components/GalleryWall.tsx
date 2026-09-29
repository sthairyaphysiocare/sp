import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The gallery wall: a bento/masonry of images and short looping clips that
 * drifts vertically on its own, with adjacent columns moving in opposite
 * directions.
 *
 * MOTION
 *
 * Each column holds its items twice and slides by exactly half its own
 * height, so the second copy arrives where the first began and the loop has
 * no visible seam. Odd columns run the same animation in reverse, which is
 * what produces the organic counter-drift.
 *
 * Hovering (or keyboard-focusing) any card pauses every column at once, not
 * just the one under the cursor — a card that stops while its neighbours keep
 * moving reads as a glitch, and the point of the pause is to let someone
 * actually look at the thing they reached for.
 *
 * The animation is CSS, not JavaScript: it runs on the compositor, so it
 * stays smooth on a phone and costs nothing per frame. It is switched off
 * entirely for anyone who has asked their system to reduce motion, and for a
 * wall too short to be worth scrolling.
 *
 * COLOUR
 *
 * The panel is the site's own deep navy (--foreground, the same colour as the
 * footer) rather than a neutral black. A true-black panel would be the one
 * surface on the site that belongs to no palette; this reads as part of the
 * page while still letting the media carry the attention.
 */

export interface GalleryMedia {
  id: string;
  kind: "image" | "video";
  url: string;
  thumbUrl: string;
  posterUrl: string;
  alt: string;
  caption: string;
  description: string;
  width: number;
  height: number;
}

/** Below this many items there is not enough wall to drift; it sits still. */
const MIN_ITEMS_TO_ANIMATE = 5;

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
          // The site's deep navy, the same surface as the footer.
          "bg-foreground",
          "px-4 py-4 sm:px-5 sm:py-5",
        )}
      >
        {/* Soft fades so cards enter and leave the wall rather than being
            sliced off by a hard edge. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-foreground to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-foreground to-transparent"
        />

        <div
          className="grid gap-4 h-[72vh] min-h-[520px] max-h-[860px]"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {columns.map((col, ci) => (
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
                {/* Two copies: the loop is seamless precisely because the
                    slide distance is half of this doubled stack. The second
                    copy is decorative, so it is hidden from assistive tech. */}
                {(animate ? [0, 1] : [0]).map((copy) =>
                  col.map((item) => (
                    <Card
                      key={`${item.id}-${copy}`}
                      item={item}
                      duplicate={copy === 1}
                      onHoverChange={setPaused}
                      onOpen={() => setLightbox(indexById.get(item.id) ?? 0)}
                    />
                  )),
                )}
              </div>
            </div>
          ))}
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

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      // The duplicate copy exists only to make the loop seamless; announcing
      // every item twice would make the wall unusable with a screen reader.
      aria-hidden={duplicate ? "true" : undefined}
      tabIndex={duplicate ? -1 : 0}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl cursor-pointer",
        "bg-background/5 ring-1 ring-white/10",
        "transition-[transform,box-shadow] duration-300 ease-out",
        "hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/50 hover:ring-white/25",
        "focus:outline-none focus-visible:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white/70",
      )}
      style={{ aspectRatio: String(ratio) }}
    >
      {item.kind === "video" ? (
        <video
          src={item.url}
          poster={item.posterUrl || undefined}
          // Silent, looping and inline: the three conditions every browser
          // requires before it will start a video without a user gesture.
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={item.alt}
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          src={item.thumbUrl}
          alt={duplicate ? "" : item.alt}
          loading="lazy"
          decoding="async"
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
  const closeRef = useRef<HTMLButtonElement | null>(null);

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
    closeRef.current?.focus();
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-sm p-4 sm:p-8"
      // Clicking the backdrop closes; clicking the media itself does not,
      // which is why the inner wrapper stops the event.
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
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
            className="absolute left-2 sm:left-5 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
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
            className="absolute right-2 sm:right-5 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
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
            src={item.url}
            poster={item.posterUrl || undefined}
            controls
            autoPlay
            loop
            muted
            playsInline
            className="max-h-[75vh] w-auto max-w-full rounded-xl"
          />
        ) : (
          <img
            src={item.url}
            alt={item.alt}
            className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain"
          />
        )}

        {(item.caption || item.description) && (
          <div className="text-center max-w-2xl">
            {item.caption && <h2 className="text-base font-semibold text-white">{item.caption}</h2>}
            {item.description && (
              <p className="mt-1 text-sm text-white/70 leading-relaxed">{item.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
