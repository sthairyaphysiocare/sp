import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContentBehind } from "@/lib/useContentBehind";

/**
 * Creative return-to-top control: a circular scroll-progress ring fills as
 * the reader moves down the page; clicking it "launches" the arrow upward
 * and smooth-scrolls home. Respects prefers-reduced-motion.
 *
 * It also gets out of the reader's way: whenever text is actually underneath
 * it the control thins out to a glass outline that words read straight
 * through, and returns to full strength the moment it is pointed at, focused,
 * or the text moves out from under it. Position, behaviour and the click
 * target are unchanged — only its weight over content is.
 */
export function BackToTop({ className }: { className?: string }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  // Only worth measuring while the control is actually on screen.
  const textBehind = useContentBehind(ref, visible);
  const quiet = textBehind && !engaged && !launching;

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        const y = window.scrollY;
        setProgress(max > 0 ? Math.min(1, y / max) : 0);
        setVisible(y > 320);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const R = 20;
  const C = 2 * Math.PI * R;

  function toTop() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      setLaunching(true);
      setTimeout(() => setLaunching(false), 650);
    }
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <button
      ref={ref}
      data-floating-ui
      type="button"
      onClick={toTop}
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      aria-label="Return to top"
      title="Return to top"
      className={cn(
        "fixed bottom-5 left-5 z-50 grid place-items-center size-12 rounded-full print:hidden",
        "backdrop-blur text-brand overflow-hidden",
        "transition-all duration-500 hover:scale-110 active:scale-95",
        // Solid over empty space; glass over words.
        quiet
          ? "bg-card/25 border border-transparent shadow-none scale-90"
          : "bg-card/90 border soft-shadow scale-100",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none",
        className,
      )}
    >
      {/* progress ring */}
      <svg
        viewBox="0 0 48 48"
        className={cn(
          "absolute inset-0 -rotate-90 transition-opacity duration-500",
          quiet ? "opacity-40" : "opacity-100",
        )}
        aria-hidden
      >
        <circle cx="24" cy="24" r={R} fill="none" strokeWidth="3" className="stroke-brand/15" />
        <circle
          cx="24"
          cy="24"
          r={R}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-150"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
        />
      </svg>
      <ArrowUp
        className={cn(
          "size-5 transition-all duration-500",
          quiet && "opacity-55",
          launching && "-translate-y-10 opacity-0 duration-500",
        )}
      />
      {/* the replacement arrow rising from below during launch */}
      <ArrowUp
        aria-hidden
        className={cn(
          "size-5 absolute translate-y-10 opacity-0",
          launching && "translate-y-0 opacity-100 transition-all duration-500 delay-100",
        )}
      />
    </button>
  );
}
