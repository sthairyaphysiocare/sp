import { LOGO_URL } from "@/lib/logo";

/**
 * Fixed background layers mounted once at the root, visible on every page
 * (public + portal) from top to bottom:
 * 1. A premium brand-gradient wash — the same treatment as the Hero section.
 * 2. The semi-transparent logo watermark.
 */
export function GlobalWatermark() {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0 brand-gradient opacity-[0.04]"
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${LOGO_URL})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "min(70vw, 760px) auto",
          opacity: 0.045,
        }}
      />
    </>
  );
}
