import { LOGO_URL } from "@/lib/logo";

/**
 * Fixed semi-transparent watermark mounted once at the root.
 * Visible across every public + portal page.
 */
export function GlobalWatermark() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        backgroundImage: `url(${LOGO_URL})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "min(75vw, 820px) auto",
        opacity: 0.05,
      }}
    />
  );
}
