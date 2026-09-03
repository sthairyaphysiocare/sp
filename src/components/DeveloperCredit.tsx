import { ArrowUpRight } from "lucide-react";

/**
 * "Developed by" credit — a link in the footer that opens a full standalone
 * profile page in a new tab (see routes/developer.tsx for that page; this
 * file is now just the trigger).
 *
 * Kept deliberately minimal: this used to also own the profile card itself,
 * rendered as a popover positioned directly above this button. That
 * collided with the fixed-position BackToTop / ContactFab buttons once a
 * visitor actually scrolled to the true bottom of the page — the popover
 * and its card both live in that same reserved bottom-corner region. Moving
 * the whole profile to its own page removes the positioning problem
 * entirely rather than trying to out-calculate two other fixed elements.
 */
export function DeveloperCredit() {
  return (
    <a
      href="/developer"
      target="_blank"
      rel="noopener noreferrer"
      className="dc-pill group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-background/85 hover:text-background transition-colors print:hidden"
    >
      <span className="dc-pill-glow" aria-hidden="true" />
      <span className="relative">
        Developed by <span className="font-semibold">Vaishak Rao Shuntipady</span>
      </span>
      <ArrowUpRight className="dc-pill-arrow relative size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      <style>{`
        .dc-pill { isolation: isolate; }
        .dc-pill-glow {
          position: absolute; inset: -6px -10px; border-radius: 999px;
          background: radial-gradient(circle, rgba(45,212,191,0.35), transparent 70%);
          opacity: 0; transition: opacity .35s ease; z-index: -1;
        }
        .dc-pill:hover .dc-pill-glow { opacity: 1; }
        .dc-pill-arrow { animation: dc-arrow-nudge 2.4s ease-in-out infinite; }
        @keyframes dc-arrow-nudge {
          0%, 80%, 100% { transform: translate(0, 0); }
          40% { transform: translate(2px, -2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dc-pill-arrow { animation: none; }
        }
      `}</style>
    </a>
  );
}
