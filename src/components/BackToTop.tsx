import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Creative return-to-top control: a circular scroll-progress ring fills as
 * the reader moves down the page; clicking it "launches" the arrow upward
 * and smooth-scrolls home. Respects prefers-reduced-motion.
 */
export function BackToTop({ className }: { className?: string }) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [launching, setLaunching] = useState(false);

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
      type="button"
      onClick={toTop}
      aria-label="Return to top"
      title="Return to top"
      className={cn(
        "fixed bottom-5 left-5 z-50 grid place-items-center size-12 rounded-full print:hidden",
        "bg-card/90 backdrop-blur border soft-shadow text-brand overflow-hidden",
        "transition-all duration-300 hover:scale-110 active:scale-95",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none",
        className,
      )}
    >
      {/* progress ring */}
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
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
          "size-5 transition-transform duration-500",
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
