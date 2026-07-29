import { useEffect, useState, type RefObject } from "react";

/**
 * Reports whether readable text is currently sitting underneath a floating
 * control, so the control can step out of the way instead of covering it.
 *
 * Rather than guessing from scroll position, this measures the real thing: it
 * samples a few points inside the control, walks what is stacked beneath them,
 * and compares the actual line boxes of any text nodes found against the
 * control's own rectangle. That means the control only dims when it is truly
 * obscuring words — over empty space, imagery or padding it stays fully solid.
 *
 * Everything is rAF-throttled and time-limited, and the element walk is capped,
 * so this stays cheap enough to run on scroll on a low-end phone.
 */

/** Sample points as fractions of the control's box — centre, then corners. */
const SAMPLES: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.5],
  [0.28, 0.28],
  [0.72, 0.72],
  [0.5, 0.12],
  [0.5, 0.88],
];

/** Anything inside a container marked this way is floating UI, not content. */
const FLOATING_ATTR = "[data-floating-ui]";

const MAX_ELEMENTS = 24;
const THROTTLE_MS = 90;

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** True if any text line inside `el` overlaps `box`. */
function textTouches(el: Element, box: DOMRect): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    if (!node.textContent || !node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const lines = range.getClientRects();
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.width < 1 || line.height < 1) continue;
      if (rectsOverlap(line, box)) return true;
    }
  }
  return false;
}

function textIsBehind(box: DOMRect): boolean {
  if (typeof document.elementsFromPoint !== "function") return false;
  const seen = new Set<Element>();

  for (const [fx, fy] of SAMPLES) {
    const x = box.left + box.width * fx;
    const y = box.top + box.height * fy;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;

    for (const el of document.elementsFromPoint(x, y)) {
      if (el === document.body || el === document.documentElement) break;
      if (el.closest(FLOATING_ATTR)) continue;
      if (seen.has(el)) continue;
      seen.add(el);
      if (textTouches(el, box)) return true;
      if (seen.size > MAX_ELEMENTS) return false;
    }
  }
  return false;
}

export function useContentBehind(ref: RefObject<HTMLElement | null>, enabled = true): boolean {
  const [behind, setBehind] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setBehind(false);
      return;
    }

    let raf = 0;
    let last = 0;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) {
        setBehind(false);
        return;
      }
      setBehind(textIsBehind(box));
    };

    const schedule = () => {
      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      last = now;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    // Settle first: fonts and images shift line boxes after first paint.
    const initial = window.setTimeout(measure, 250);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ref, enabled]);

  return behind;
}
