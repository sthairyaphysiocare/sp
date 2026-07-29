import type { Branch, AppSettings } from "./types";

export const LOGO_URL: string = "/logo.jpg";

/**
 * Safari (iOS + macOS) refuses to paint an <img> whose src is an external URL
 * when that image is inside the SVG `foreignObject` that html-to-image
 * serialises. Chrome and Edge paint it happily, which is why the prescription
 * logo rendered on Android/Windows but vanished on Apple devices. Data URLs
 * are always painted, so every export path inlines the logo through here.
 *
 * The source file is a ~400 KB JPEG; it is re-encoded down to `maxSize` px so
 * the base64 payload embedded in the capture stays small enough for mobile
 * Safari to handle without stalling.
 */
let logoDataPromise: Promise<string | null> | null = null;

export function getLogoDataUrl(maxSize = 512): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (logoDataPromise) return logoDataPromise;

  logoDataPromise = new Promise<string | null>((resolve) => {
    const img = new Image();
    // Same-origin asset, so the canvas is never tainted and no CORS
    // negotiation (which Safari can fail) is required.
    img.decoding = "sync";
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = LOGO_URL;
  });

  return logoDataPromise;
}

/**
 * The decoded logo bitmap, for painting straight onto a canvas.
 *
 * This is the reliable path. Safari mis-renders an <img> inside the SVG
 * foreignObject that html-to-image rasterises through — `object-fit` is
 * ignored, so the 1068x768 source is drawn unscaled into an 80x80 box and all
 * that survives the clip is a fragment of the badge's blue rim (the "arc").
 * Compositing the logo onto the finished canvas ourselves sidesteps the
 * rasteriser entirely, so every engine gets identical output.
 */
let logoImagePromise: Promise<HTMLImageElement | null> | null = null;

export function getLogoImage(): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (logoImagePromise) return logoImagePromise;

  logoImagePromise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = LOGO_URL;
  });

  return logoImagePromise;
}

/** True on iPhone, iPad (including desktop-mode) and macOS Safari. */
export function isAppleWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua);
  const iPadDesktopMode = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  const desktopSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|CriOS|FxiOS/.test(ua);
  return iOS || iPadDesktopMode || desktopSafari;
}

export const CLINIC = {
  name: "Sthairya Physiocare",
  tagline: "Resilience • Firmness • Balance",
  domain: "sthairya-physiocare.co.in",
  address: "Vivekananda College Road, Nehru Nagar, Puttur - 574203",
  mapRef: "Q5HJ+MR Nehru Nagar, Puttur, Karnataka",
  mapUrl: "https://maps.app.goo.gl/MZ4wvMrzUvT4CGFM8",
  phone: "+91 9900315254",
  whatsapp: "919900315254",
  email: "Gana.Plinija@gmail.com",
};

export const DEFAULT_BRANCH: Branch = {
  id: "br-puttur",
  name: "Puttur",
  address: CLINIC.address,
  mapUrl: CLINIC.mapUrl,
  phone: CLINIC.phone,
  license: "",
  enabled: true,
};

export function enabledBranches(s: AppSettings): Branch[] {
  return (s.branches ?? []).filter((b) => b.enabled);
}

export function branchById(s: AppSettings, id?: string): Branch | undefined {
  if (!id) return undefined;
  return (s.branches ?? []).find((b) => b.id === id);
}

export function whatsappDigits(s: AppSettings): string {
  return (s.whatsappNumber || CLINIC.whatsapp).replace(/[^0-9]/g, "");
}
