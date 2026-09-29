import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * The gallery: a three-dimensional coverflow.
 *
 * WHY NOT A MARQUEE
 *
 * This replaced a pair of rows that slid continuously sideways. With a clinic
 * gallery of five or six photographs, a continuous strip has to repeat its
 * contents to fill the width, and repetition at that scale is not subtle — it
 * reads as the same pictures going past again, which is precisely what it is.
 * Constant linear motion is also monotonous: nothing is ever emphasised, so
 * nothing invites a look.
 *
 * A coverflow shows each photograph exactly once. One is face-on and
 * dominant, its neighbours recede in perspective, and the ring advances in
 * unhurried steps rather than sliding without pause. Every step changes what
 * is emphasised, which is what makes it worth watching.
 *
 * NO PHOTOGRAPH IS EVER SHOWN TWICE AT ONCE
 *
 * The ring wraps, so with few photographs a naive fixed depth would place the
 * same item at both -2 and +2. The visible depth is therefore capped at
 * floor((n-1)/2), which guarantees every visible slot holds a different
 * photograph however few there are.
 *
 * MOTION AND CONTROL
 *
 * It advances on its own, and stops for any pointer — hover, touch or
 * keyboard focus. It can be driven by arrow keys, by the buttons, by the
 * dots, or by swiping. Anyone who has asked their system to reduce motion
 * gets no automatic advance at all, and a plain responsive grid instead of
 * the perspective stage.
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

/** How long each photograph holds the front position. */
const ADVANCE_MS = 4200;

/** Deepest neighbour drawn on each side, before the wrap-around cap. */
const MAX_DEPTH = 2;

/** A swipe shorter than this is a tap, not a gesture. */
const SWIPE_PX = 40;

/**
 * Show a transformed URL, but fall back to the original if it will not load.
 *
 * The transformed URLs are built by rewriting the one Cloudinary gave us, and
 * an account with strict transformations enabled serves the original while
 * refusing every derived version — which reaches the page as nothing more
 * informative than a broken image. Falling back keeps the gallery working
 * whatever that account setting happens to be.
 */
function useSrcWithFallback(preferred: string, original?: string) {
  const [src, setSrc] = useState(preferred || original || "");
  const [failed, setFailed] = useState(false);

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
  const n = items.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const go = useCallback((delta: number) => setActive((i) => (i + delta + n) % n), [n]);

  // Advance on its own, unless something is asking for attention: a pointer on
  // the stage, the viewer being open, a single photograph, or a stated
  // preference for less motion.
  useEffect(() => {
    if (paused || reducedMotion || n < 2 || lightbox !== null) return;
    const t = setInterval(() => setActive((i) => (i + 1) % n), ADVANCE_MS);
    return () => clearInterval(t);
  }, [paused, reducedMotion, n, lightbox]);

  // Arrow keys drive the ring whenever the viewer is closed.
  useEffect(() => {
    if (lightbox !== null || n < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, lightbox, n]);

  // Capped so the wrap-around can never place one photograph in two slots.
  const depth = Math.min(MAX_DEPTH, Math.floor((n - 1) / 2));

  const slots = useMemo(() => {
    return items.map((item, i) => {
      // Shortest signed distance around the ring, so the nearest neighbours
      // are the ones drawn regardless of where the indices wrap.
      let off = i - active;
      if (off > n / 2) off -= n;
      if (off < -n / 2) off += n;
      return { item, i, off, visible: Math.abs(off) <= depth };
    });
  }, [items, active, n, depth]);

  const current = items[active];

  // Reduced motion, or a single photograph: a plain grid, no perspective and
  // nothing moving. Still fully browsable, and still opens the viewer.
  if (reducedMotion || n === 1) {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightbox(i)}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border bg-card cursor-pointer transition-shadow hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Media item={item} />
              <CardCaption item={item} />
            </button>
          ))}
        </div>
        {lightbox !== null && (
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

  return (
    <>
      <div
        className="select-none"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={(e) => {
          setPaused(true);
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          setPaused(false);
          const start = touchX.current;
          touchX.current = null;
          if (start === null) return;
          const dx = (e.changedTouches[0]?.clientX ?? start) - start;
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
        }}
      >
        {/* The perspective stage. The page's own background shows through —
            the gallery paints no panel of its own. */}
        <div
          // overflow-hidden matters on a phone: the receding neighbours reach
          // past the screen edge, and without clipping they give the whole
          // page a sideways scrollbar.
          className="relative overflow-hidden h-[380px] sm:h-[480px] lg:h-[580px]"
          // perspectiveOrigin is centred. Moving it off-centre makes every
          // receding card drift towards the vanishing point, so the row of
          // cards stops sharing a baseline and reads as misaligned.
          style={{ perspective: "1600px", perspectiveOrigin: "50% 50%" }}
          role="group"
          aria-roledescription="carousel"
          aria-label="Clinic gallery"
        >
          {slots.map(({ item, i, off, visible }) => {
            const abs = Math.abs(off);
            const sign = Math.sign(off);
            return (
              /*
               * POSITIONING LIVES ON THIS WRAPPER, NOT ON THE CARD.
               *
               * The site's enhancement script binds a hover tilt to every
               * `main .bg-card` and writes an inline `transform` on mousemove
               * and again on mouseleave. Anything holding its position in
               * `transform` therefore loses that position the moment a mouse
               * touches it — including the translate(-50%, -50%) that centres
               * it, which is what threw the hovered card down and to the
               * right and later stacked every card on one spot.
               *
               * A plain div carries no `.bg-card` and is not a button, so the
               * script leaves it alone and the geometry holds. The card
               * inside is free to be hovered, lifted and tilted; whatever it
               * does to its own transform cannot move the frame it sits in.
               */
              <div
                key={item.id}
                className={cn(
                  "absolute top-1/2 left-1/2",
                  "w-[82%] max-w-[320px] sm:w-[62%] sm:max-w-[480px] lg:max-w-[600px] h-[88%]",
                  // Only transform and opacity animate, so the whole stage
                  // stays on the compositor and remains smooth on a phone.
                  "transition-[transform,opacity] duration-700",
                  "[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
                )}
                style={{
                  transform: [
                    "translate(-50%, -50%)",
                    // Not a straight multiple of the depth: perspective
                    // already pulls a receding card towards the centre, so a
                    // linear step leaves the second neighbour almost entirely
                    // hidden behind the first. These two values place each
                    // one where a usable strip of it stays visible.
                    `translateX(${sign * (abs === 1 ? 56 : abs >= 2 ? 94 : 0)}%)`,
                    `translateZ(${-abs * 260}px)`,
                    `rotateY(${-sign * Math.min(abs, 2) * 30}deg)`,
                    `scale(${1 - abs * 0.05})`,
                  ].join(" "),
                  opacity: visible ? 1 - abs * 0.3 : 0,
                  zIndex: 20 - abs,
                  pointerEvents: visible ? "auto" : "none",
                }}
              >
                <button
                  type="button"
                  onClick={() => (off === 0 ? setLightbox(i) : go(off))}
                  aria-hidden={visible ? undefined : "true"}
                  tabIndex={visible ? 0 : -1}
                  aria-label={
                    off === 0
                      ? `Open ${item.caption || "photo"}`
                      : `Show ${item.caption || "photo"}`
                  }
                  className={cn(
                    "group relative block h-full w-full cursor-pointer overflow-hidden rounded-2xl",
                    // Deliberately not `bg-card`: that class is what the tilt
                    // script looks for. The colour only shows if an image
                    // fails to load.
                    "border bg-muted",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    off === 0
                      ? "shadow-2xl shadow-foreground/25"
                      : "shadow-lg shadow-foreground/10",
                  )}
                >
                  <Media item={item} />
                  {/* Neighbours are dimmed so the front photograph is plainly
                      the subject rather than one of three competing for it. */}
                  {off !== 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-foreground/25 transition-opacity duration-700"
                    />
                  )}
                  {off === 0 && <CardCaption item={item} />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Controls sit below the stage rather than over the photographs. */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="grid size-10 place-items-center rounded-full border bg-card text-foreground/70 hover:text-brand hover:border-brand/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="flex items-center gap-1.5">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1} of ${n}`}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  i === active ? "w-6 bg-brand" : "w-1.5 bg-foreground/25 hover:bg-foreground/40",
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="grid size-10 place-items-center rounded-full border bg-card text-foreground/70 hover:text-brand hover:border-brand/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* The description belongs under the stage on a phone, where there is
            no hover to reveal it and the caption strip has no room for it. */}
        {current?.description && (
          <p className="mt-3 text-center text-sm text-muted-foreground max-w-xl mx-auto sm:hidden">
            {current.description}
          </p>
        )}
      </div>

      {lightbox !== null && (
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

/** The photograph or clip itself, with its fallback behaviour. */
function Media({ item }: { item: GalleryMedia }) {
  const media = useSrcWithFallback(
    item.kind === "video" ? item.url : item.thumbUrl,
    item.originalUrl,
  );

  if (media.failed) {
    // Never a broken-image icon: a tile carrying its own caption still reads
    // as part of the gallery, where a torn-page glyph reads as a broken site.
    return (
      <span className="absolute inset-0 grid place-items-center bg-muted px-4 text-center">
        <span className="text-xs text-muted-foreground">{item.caption || item.alt}</span>
      </span>
    );
  }

  return (
    <>
      {item.kind === "video" ? (
        <video
          src={media.src}
          poster={item.posterUrl || undefined}
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
          alt={item.alt}
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
    </>
  );
}

/** Caption always visible; description revealed on hover where one exists. */
function CardCaption({ item }: { item: GalleryMedia }) {
  if (!item.caption && !item.description) return null;
  return (
    <span className="absolute inset-x-0 bottom-0 p-3 text-left bg-gradient-to-t from-black/85 via-black/45 to-transparent">
      {item.caption && (
        <span className="block text-sm font-semibold text-white leading-snug">{item.caption}</span>
      )}
      {item.description && (
        <span
          className={cn(
            "hidden sm:block text-xs text-white/80 leading-snug",
            "max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-out",
            "group-hover:mt-1 group-hover:max-h-16 group-hover:opacity-100",
            "[button:hover_&]:mt-1 [button:hover_&]:max-h-16 [button:hover_&]:opacity-100",
          )}
        >
          {item.description}
        </span>
      )}
    </span>
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
  const full = useSrcWithFallback(item?.url ?? "", item?.originalUrl);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

    // Lock the page behind the viewer.
    //
    // `overflow: hidden` on <body> is not enough on mobile Safari and several
    // Android browsers: the page keeps scrolling underneath, and because the
    // viewer is the height of the visual viewport, scrolling the page moves
    // the close button out of reach — which is exactly the trap reported here.
    // Pinning the body at its current offset holds it still everywhere, and
    // the offset is restored on close so nobody loses their place.
    const scrollY = window.scrollY;
    const body = document.body;
    const prevStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.position = prevStyles.position;
      body.style.top = prevStyles.top;
      body.style.left = prevStyles.left;
      body.style.right = prevStyles.right;
      body.style.width = prevStyles.width;
      body.style.overflow = prevStyles.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [onClose, prev, next]);

  if (!item || !mounted) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption || "Gallery item"}
      className="fixed inset-0 z-[9999] flex flex-col bg-foreground/95 backdrop-blur-sm"
      style={{
        // dvh follows the mobile browser's collapsing toolbars; the vh value
        // before it is the fallback for browsers that do not know dvh.
        height: "100vh",
        maxHeight: "100dvh",
      }}
      onClick={onClose}
    >
      {/* A dedicated top bar, so the close control is part of the layout and
          cannot be pushed off-screen or hidden under browser chrome. */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-background/60 tabular-nums">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-11 place-items-center rounded-full bg-background/15 text-background hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background transition-colors"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Scrolls on its own if a photograph and a long description do not fit,
          rather than relying on the page behind it, which is locked. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-full flex flex-col items-center justify-center gap-4">
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
              className="max-h-[70vh] w-auto max-w-full rounded-xl"
            />
          ) : (
            <img
              src={full.src}
              alt={item.alt}
              onError={full.onError}
              className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
            />
          )}

          {(item.caption || item.description) && (
            <div className="text-center max-w-2xl">
              {item.caption && (
                <h2 className="text-base font-semibold text-background">{item.caption}</h2>
              )}
              {item.description && (
                <p className="mt-1 text-sm text-background/75 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {items.length > 1 && (
        <div
          className="flex items-center justify-center gap-6 px-4 py-3 shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="grid size-11 place-items-center rounded-full bg-background/15 text-background hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background transition-colors"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="grid size-11 place-items-center rounded-full bg-background/15 text-background hover:bg-background/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-background transition-colors"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      )}
    </div>
  );

  // Rendered at the end of <body>, deliberately.
  //
  // A `position: fixed` element is positioned against the viewport ONLY while
  // no ancestor carries a transform, filter or perspective. This page's
  // enhancement layer sets transforms on cards and buttons, and the stage
  // above sets a perspective — any of which would silently turn the viewer
  // into a box positioned inside the gallery instead of over the screen, with
  // its close button wherever that box happened to land. A portal puts it
  // beyond all of them.
  return createPortal(overlay, document.body);
}
