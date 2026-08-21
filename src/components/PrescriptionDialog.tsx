import { useEffect, useRef, useState } from "react";
import {
  LOGO_URL,
  branchById,
  getLogoDataUrl,
  getLogoImage,
  isAppleWebKit,
  whatsappDigits,
} from "@/lib/logo";
import { BUILD_ID } from "@/lib/build";
import { ENQUIRY_MESSAGE, ENQUIRY_SUBJECT, mailtoLink } from "@/lib/contactLinks";
import type { Patient, Visit } from "@/lib/types";
import { slotConflict, store, takenSlotsForDate, useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Printer,
  Download,
  X,
  ArrowLeft,
  ArrowRight,
  Eye,
  Pencil,
  Receipt,
  Plus,
  Trash2,
  Save,
  History,
  MapPin,
  Phone,
  Mail,
  Globe,
  ScrollText,
} from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { toast } from "sonner";
import { amountInWordsINR, cn } from "@/lib/utils";
import { fmtDate, fmtTime12, slotsForDateBranch, todayISO } from "@/lib/date";

interface HistoricalRecord {
  rx: {
    concern: string;
    diagnosis: string;
    manualTherapy: string;
    modalities: string;
    exercises: string;
    advice: string;
    reviewDate: string;
    reviewTime: string;
  };
  receipt: { no: string; mode: string; items: ReceiptItem[]; paid: number; notes: string };
  receiptOn: boolean;
  savedAt: number;
}

interface Props {
  patient: Patient;
  lastVisit?: Visit;
  onClose: () => void;
  /** When provided, opens directly in preview mode showing this saved record. */
  historical?: HistoricalRecord;
}

type Step = "edit" | "preview";

/** 1x1 transparent GIF — holds a logo's layout box without rasterising it. */
const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
/** Ring around the header logo; a flat hex so no color function is involved. */
const LOGO_RING = "#cce6f4";

interface ReceiptItem {
  id: string;
  desc: string;
  qty: number;
  rate: number;
}

const SERVICE_PRESETS = [
  "Physiotherapy Consultation",
  "Therapeutic Exercise Session",
  "Manual Therapy",
  "Electrotherapy / Ultrasound",
  "IFT / TENS Session",
  "Dry Needling",
  "Cupping Therapy",
  "Postural Correction",
  "Sports Rehabilitation",
  "Home Visit Charges",
];

export function PrescriptionDialog({ patient, lastVisit, onClose, historical }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = fmtDate(new Date());
  const todayIso = todayISO();
  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "—";

  const settings = useStore((s) => s.settings);
  const branch = branchById(settings, patient.br) ?? settings.branches[0];

  const [step, setStep] = useState<Step>(historical ? "preview" : "edit");
  const [rx, setRx] = useState(
    historical
      ? historical.rx
      : {
          concern: "",
          diagnosis: patient.cc || "",
          manualTherapy: lastVisit?.tx || "",
          modalities: "",
          exercises: lastVisit?.adv || "",
          advice: "",
          reviewDate: lastVisit?.nxt || "",
          reviewTime: lastVisit?.nxtTm || "",
        },
  );
  const [receiptOn, setReceiptOn] = useState(historical?.receiptOn ?? false);
  const [savedReceiptNo, setSavedReceiptNo] = useState<string | null>(
    historical?.receipt.no ? historical.receipt.no : null,
  );
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(
    historical?.receipt ?? {
      no: "",
      mode: "Cash",
      items: [] as ReceiptItem[],
      paid: 0,
      notes: "",
    },
  );
  const [busy, setBusy] = useState<null | "pdf" | "print">(null);

  // Inlined copy of the clinic logo. Preloaded as soon as the dialog opens so
  // that Download / WhatsApp / Print never have to wait on it, and so Safari
  // always has a data URL to paint (see getLogoDataUrl for the why).
  // Opt-in diagnostics: `?rxdebug=1` surfaces which bundle is running and what
  // the export pipeline actually did, so Safari issues can be diagnosed on the
  // device itself instead of inferred.
  const [debugOn, setDebugOn] = useState(false);
  const [diag, setDiag] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDebugOn(new URLSearchParams(window.location.search).has("rxdebug"));
    } catch {
      setDebugOn(false);
    }
  }, []);

  const [logoData, setLogoData] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getLogoDataUrl().then((d) => {
      if (alive) setLogoData(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  const logoSrc = logoData ?? LOGO_URL;

  const reviewSlots = slotsForDateBranch(rx.reviewDate, branch);
  const reviewTaken = useStore((s) => takenSlotsForDate(s, rx.reviewDate, lastVisit?.id));
  const has = (s: string) => !!(s && s.trim());

  const receiptTotal = receipt.items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0),
    0,
  );
  const receiptHasContent =
    receiptOn && receipt.items.some((i) => i.desc.trim() && (i.qty > 0 || i.rate > 0));

  /**
   * Describes what the generated PDF actually contains, for the WhatsApp
   * message. Three independent parts can be present:
   *
   *   referral note   - "To Whomsoever It May Concern" has been filled in
   *   prescription    - any clinical section is filled (diagnosis, manual
   *                     therapy, modalities, exercise protocol, advice)
   *   payment receipt - the receipt is switched on and has a usable line item
   *
   * They are listed in that fixed order and joined as "a", "a and b", or
   * "a, b and c", so every combination reads naturally.
   */
  function describeContents(): string {
    const parts: string[] = [];
    if (has(rx.concern)) parts.push("referral note");
    if (
      has(rx.diagnosis) ||
      has(rx.manualTherapy) ||
      has(rx.modalities) ||
      has(rx.exercises) ||
      has(rx.advice)
    ) {
      parts.push("prescription");
    }
    if (receiptHasContent) parts.push("payment receipt");

    // An empty sheet is still a prescription form, so fall back to that rather
    // than producing "Please find the from ...".
    if (parts.length === 0) return "prescription";
    if (parts.length === 1) return parts[0];
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }

  function whatsappMessage(): string {
    return `Hi, Please find the ${describeContents()} from Sthairya Physiocare.`;
  }

  /**
   * The clinic's contact details, resolved once so the header, the PDF link
   * annotations and the print copy all describe exactly the same thing.
   */
  const branchEmail = branch ? branch.emailId || settings.globalEmail : "";
  const branchWeb =
    settings.prescriptionUrlEnabled !== false && settings.prescriptionUrl
      ? settings.prescriptionUrl
      : "";

  /** Adds https:// when a bare host was configured, so links always resolve. */
  const absoluteUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

  /**
   * Anchors in the header are also targets for the PDF's link annotations.
   *
   * The PDF is a rasterised image of this preview, so text in it is not
   * clickable by itself. Each contact row is measured here and a matching
   * annotation is laid over the same spot in the PDF, which makes the phone,
   * email and website live in the exported file as well as on screen.
   */
  const sheetRef = ref;
  const linkRefs = useRef<Record<string, HTMLElement | null>>({});
  const setLinkRef = (key: string) => (el: HTMLElement | null) => {
    linkRefs.current[key] = el;
  };

  /**
   * Overlays clickable regions onto the generated PDF, aligned to where the
   * header links appear in the captured image.
   */
  function addHeaderLinks(pdf: import("jspdf").jsPDF, pageWidthMm: number) {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const base = sheet.getBoundingClientRect();
    if (!base.width) return;
    // The capture is scaled to the page width, so CSS pixels convert by this.
    const mmPerPx = pageWidthMm / base.width;

    for (const [, entry] of Object.entries(linkRefs.current)) {
      if (!entry) continue;
      const href = entry.getAttribute("href");
      if (!href) continue;
      const r = entry.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      pdf.link(
        (r.left - base.left) * mmPerPx,
        (r.top - base.top) * mmPerPx,
        r.width * mmPerPx,
        r.height * mmPerPx,
        { url: href },
      );
    }
  }

  /**
   * Copies text synchronously, inside the tap that triggered it.
   *
   * WhatsApp discards the text that accompanies a shared document and opens its
   * own empty caption box instead — nothing a browser sends can populate it. So
   * the message is placed on the clipboard, and pasting it is one long-press.
   *
   * execCommand is deprecated but runs synchronously, so it cannot consume the
   * transient activation that navigator.share needs immediately afterwards. The
   * asynchronous Clipboard API is fired afterwards as an upgrade, and its
   * failure does not matter because the sync path has already succeeded.
   */
  function copyMessageSync(text: string): boolean {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      ta.remove();
      void navigator.clipboard?.writeText(text).catch(() => undefined);
      return ok;
    } catch {
      try {
        void navigator.clipboard?.writeText(text).catch(() => undefined);
      } catch {
        // Nothing further to try.
      }
      return false;
    }
  }

  /**
   * Cached copy of the generated PDF, so a repeat send does not rebuild it.
   * Only valid while the preview is on screen: content cannot change without
   * returning to the Content step, and leaving the step clears it.
   */
  const [waFile, setWaFile] = useState<{ blob: Blob; filename: string } | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (step !== "preview") setWaFile(null);
  }, [step]);

  /**
   * Sends the prescription through WhatsApp with the PDF and the message
   * together, in one step.
   *
   * The share sheet is the only browser mechanism that can attach a file, and
   * it chooses the recipient itself — no web API can place a file into a chat
   * with a particular number — so no number is asked for.
   *
   * navigator.share needs transient user activation, which a slow PDF build can
   * outlast. If that happens the file is already cached, so a second tap goes
   * straight to the sheet; the toast says so rather than failing silently.
   */
  async function sendWhatsApp() {
    if (sharing) return;
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    setSharing(true);
    try {
      let ready = waFile;
      if (!ready) {
        toast.loading("Preparing prescription...", { id: "wa" });
        const out = await buildPdf();
        if (!out) throw new Error("PDF generation failed");
        ready = { blob: out.blob, filename: out.filename };
        setWaFile(ready);
      }

      const message = whatsappMessage();
      const file = new File([ready.blob], ready.filename, { type: "application/pdf" });

      if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
        // Copied before the sheet opens, so the message is already on the
        // clipboard by the time WhatsApp's caption box appears. The text is
        // still passed to share() as well: WhatsApp ignores it for documents,
        // but other targets — email, Telegram, Drive — do use it.
        const copied = copyMessageSync(message);
        toast[copied ? "success" : "info"](
          copied
            ? "Message copied. In WhatsApp, long-press the caption box and tap Paste."
            : "WhatsApp won't accept a caption from a browser — type the message in the caption box.",
          { id: "wa", duration: 12000 },
        );
        try {
          await nav.share({ files: [file], text: message, title: message });
        } catch (err) {
          const name = (err as Error)?.name;
          // Dismissing the sheet is a cancel, not a failure.
          if (name === "AbortError") return;
          if (name === "NotAllowedError") {
            toast.info("Prescription ready — tap Send via WhatsApp again to choose the contact.", {
              id: "wa",
              duration: 7000,
            });
            return;
          }
          throw err;
        }
        return;
      }

      // No file sharing here (desktop browsers). Save the PDF and put the
      // message on the clipboard so both can be dropped into WhatsApp Web.
      const url = URL.createObjectURL(ready.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ready.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      const copiedDesktop = copyMessageSync(message);
      toast.success(
        copiedDesktop
          ? "PDF saved and message copied — attach the PDF in WhatsApp and paste the message."
          : "PDF saved — attach it in WhatsApp and add the message.",
        { id: "wa", duration: 9000 },
      );
    } catch (err) {
      console.error("WA send failed", err);
      toast.error("Couldn't prepare the prescription. Please retry.", { id: "wa" });
    } finally {
      setSharing(false);
    }
  }

  function addReceiptItem(desc = "") {
    setReceipt((r) => ({
      ...r,
      items: [
        ...r.items,
        { id: `i${Date.now()}${Math.random().toString(36).slice(2, 5)}`, desc, qty: 1, rate: 0 },
      ],
    }));
  }
  function updateReceiptItem(id: string, patch: Partial<ReceiptItem>) {
    setReceipt((r) => ({
      ...r,
      items: r.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }
  function removeReceiptItem(id: string) {
    setReceipt((r) => ({ ...r, items: r.items.filter((it) => it.id !== id) }));
  }

  async function waitForImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            }),
      ),
    );
  }

  /**
   * Primary renderer: rasterizes the actual on-screen preview so the PDF is
   * pixel-identical to what the preview page shows (same background,
   * watermark, layout). Uses html-to-image, which renders via the browser
   * itself (SVG foreignObject) and therefore supports the modern CSS colors
   * that broke the old html2canvas capture. Falls back to the drawn
   * renderer on any failure.
   */
  async function buildPdf(): Promise<{ blob: Blob; filename: string; image?: string } | null> {
    try {
      if (step !== "preview") {
        setStep("preview");
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      }
      const node = ref.current;
      if (!node) throw new Error("Preview not mounted");
      await waitForImages(node);
      // Webfonts are embedded into the capture by html-to-image; if they are
      // still loading Safari rasterises fallback glyphs (or nothing at all).
      await document.fonts?.ready?.catch?.(() => undefined);
      await new Promise((r) => setTimeout(r, 80));

      const logoImg = await getLogoImage();
      const log: string[] = [
        `build ${BUILD_ID}`,
        `webkit ${isAppleWebKit()}`,
        `logo ${logoImg ? `${logoImg.naturalWidth}x${logoImg.naturalHeight}` : "FAILED TO LOAD"}`,
      ];

      // Capture a CLONE inside an off-screen sandbox with a hard-coded A4
      // pixel width, zero margins, and no inherited transforms — so screen
      // centering (mx-auto), responsive scaling, or flex alignment from the
      // dialog can never shift or crop the output.
      const A4_PX = 794; // 210mm at 96dpi
      const sandbox = document.createElement("div");
      sandbox.style.cssText =
        "position:fixed;left:-10000px;top:0;width:" +
        A4_PX +
        "px;margin:0;padding:0;transform:none;z-index:-1;background:#ffffff;";
      const clone = node.cloneNode(true) as HTMLElement;
      clone.style.cssText +=
        ";width:" +
        A4_PX +
        "px !important;min-width:" +
        A4_PX +
        "px;max-width:" +
        A4_PX +
        "px;margin:0 !important;transform:none !important;box-shadow:none;left:0;right:auto;";
      sanitizeCloneForCapture(clone);

      // Pin the capture to exactly one A4 page. The live sheet is `min-height:
      // 297mm`, so its scrollHeight routinely measures a few pixels over the
      // page — enough for the old code to emit a second, near-empty page. A
      // small tolerance absorbs that rounding; genuinely overflowing content
      // (a long receipt) still paginates.
      const PAGE_PX = Math.round((A4_PX * 297) / 210); // 1123px = A4 @96dpi
      sandbox.appendChild(clone);
      document.body.appendChild(sandbox);
      const captureH = clone.scrollHeight <= PAGE_PX + 12 ? PAGE_PX : clone.scrollHeight;
      clone.style.setProperty("height", `${captureH}px`, "important");
      clone.style.setProperty("min-height", "0", "important");
      clone.style.setProperty("overflow", "hidden", "important");

      let dataUrl: string;
      const RATIO = 2;
      try {
        await waitForImages(clone);
        const { toCanvas } = await import("html-to-image");
        const opts = {
          pixelRatio: RATIO,
          backgroundColor: "#ffffff",
          // cacheBust appends a query string, forcing a fresh cross-origin-mode
          // refetch that Safari can reject, and nothing needs busting here.
          cacheBust: false,
          width: A4_PX,
          height: captureH,
          style: { margin: "0", transform: "none" },
        };
        // Safari's foreignObject pipeline returns an incomplete first render.
        // A cheap throwaway pass primes it before the capture that counts.
        if (isAppleWebKit()) {
          await toCanvas(clone, { ...opts, pixelRatio: 1 }).catch(() => undefined);
        }
        const canvas = await toCanvas(clone, opts);
        log.push(`canvas ${canvas.width}x${canvas.height}`);
        const blank = isBlankCapture(canvas);
        log.push(`blank ${blank}`);
        if (blank) throw new Error("rasteriser returned a blank sheet");
        // Derive the scale from the canvas actually produced rather than
        // assuming it equals pixelRatio: html-to-image silently shrinks the
        // canvas when it would exceed the browser's maximum dimensions, which
        // would otherwise put the composited logos in the wrong place.
        const scale = canvas.width / Math.max(1, clone.getBoundingClientRect().width);
        // The logo placeholders left by sanitizeCloneForCapture are filled in
        // here, on the finished bitmap, where the crop maths is ours and not
        // the rasteriser's.
        log.push(`scale ${scale.toFixed(2)}`);
        log.push(`logos ${clone.querySelectorAll("[data-rx-logo]").length}`);
        drawLogosOnto(canvas, clone, scale, logoImg);
        dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        log.push(`jpeg ${Math.round(dataUrl.length / 1024)}kb`);
      } finally {
        sandbox.remove();
      }

      const probe = new Image();
      await new Promise<void>((res, rej) => {
        probe.onload = () => res();
        probe.onerror = () => rej(new Error("capture decode failed"));
        probe.src = dataUrl;
      });

      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const imgH = (probe.height * pw) / probe.width;
      // 2mm of slack: anything within a rounding error of A4 is one page.
      if (imgH <= ph + 2) {
        pdf.addImage(dataUrl, "JPEG", 0, 0, pw, Math.min(imgH, ph));
      } else {
        let y = 0;
        let remaining = imgH;
        let guard = 0;
        while (remaining > 0.5 && guard < 20) {
          pdf.addImage(dataUrl, "JPEG", 0, y, pw, imgH);
          remaining -= ph;
          y -= ph;
          guard += 1;
          if (remaining > 0.5) pdf.addPage();
        }
      }
      // Link annotations sit on page 1, where the header is.
      pdf.setPage(1);
      addHeaderLinks(pdf, pw);

      const filename = `PRN_${patient.pid}_${Date.now()}.pdf`;
      // The bitmap is handed back too: printing reuses it rather than asking
      // the browser to print a PDF, which is what broke printing everywhere.
      log.push(`pages ${pdf.getNumberOfPages()}`);
      log.push("path capture");
      setDiag(log);
      return { blob: pdf.output("blob"), filename, image: dataUrl };
    } catch (err) {
      console.error("Preview capture failed, using drawn fallback:", err);
      setDiag([
        `build ${BUILD_ID}`,
        `webkit ${isAppleWebKit()}`,
        "path DRAWN FALLBACK",
        `error ${err instanceof Error ? err.message : String(err)}`,
      ]);
      return buildPdfDrawn();
    }
  }

  /**
   * Prepares a cloned sheet for rasterising.
   *
   * The two logo <img> elements are blanked out rather than captured. Safari
   * ignores `object-fit` inside the SVG foreignObject that html-to-image
   * renders through, so the 1068x768 source got drawn at its natural size into
   * an 80x80 box and clipped — leaving only a crescent of the badge's blue rim,
   * which is the "light blue arc" on iPhone. Their boxes are kept so layout is
   * untouched; drawLogosOnto() paints the real artwork on afterwards.
   *
   * Box shadows go too: Tailwind's `ring-*` compiles to one, and WebKit renders
   * shadows on rounded elements inside foreignObject as detached fragments.
   */
  function sanitizeCloneForCapture(clone: HTMLElement) {
    clone.querySelectorAll<HTMLImageElement>("[data-rx-logo]").forEach((img) => {
      img.removeAttribute("crossorigin");
      img.setAttribute("src", BLANK_PIXEL);
      img.style.setProperty("visibility", "hidden", "important");
    });
    clone.querySelectorAll<HTMLElement>("*").forEach((el) => {
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("text-shadow", "none", "important");
      el.style.setProperty("filter", "none", "important");
      el.style.setProperty("animation", "none", "important");
      el.style.setProperty("transition", "none", "important");
    });
    clone.style.setProperty("box-shadow", "none", "important");
  }

  /**
   * Paints the header logo and the watermark onto the captured bitmap at the
   * exact positions their placeholders occupy, reproducing `object-cover`,
   * `object-contain`, the circular mask and the border in plain canvas calls.
   */
  function drawLogosOnto(
    canvas: HTMLCanvasElement,
    clone: HTMLElement,
    ratio: number,
    img: HTMLImageElement | null,
  ) {
    if (!img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const base = clone.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return;

    clone.querySelectorAll<HTMLElement>("[data-rx-logo]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const x = (r.left - base.left) * ratio;
      const y = (r.top - base.top) * ratio;
      const w = r.width * ratio;
      const h = r.height * ratio;
      if (w < 1 || h < 1) return;

      ctx.save();
      if (el.dataset.rxLogo === "watermark") {
        // object-contain, at the same 7% opacity as the on-screen preview.
        ctx.globalAlpha = 0.07;
        const s = Math.min(w / nw, h / nh);
        ctx.drawImage(img, x + (w - nw * s) / 2, y + (h - nh * s) / 2, nw * s, nh * s);
      } else {
        // object-cover inside a circular mask, then the border ring on top.
        const border = 2 * ratio;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const radius = Math.min(w, h) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, radius - border), 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const s = Math.max((w - border * 2) / nw, (h - border * 2) / nh);
        ctx.drawImage(img, cx - (nw * s) / 2, cy - (nh * s) / 2, nw * s, nh * s);
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0, radius - border / 2), 0, Math.PI * 2);
        ctx.lineWidth = border;
        ctx.strokeStyle = LOGO_RING;
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  /**
   * Guards against WebKit handing back an empty bitmap: if the sheet came out
   * essentially blank, the drawn fallback is used instead of exporting a page
   * containing nothing but a logo.
   */
  function isBlankCapture(canvas: HTMLCanvasElement): boolean {
    try {
      const probe = document.createElement("canvas");
      probe.width = 60;
      probe.height = 85;
      const pctx = probe.getContext("2d");
      if (!pctx) return false;
      pctx.fillStyle = "#ffffff";
      pctx.fillRect(0, 0, probe.width, probe.height);
      pctx.drawImage(canvas, 0, 0, probe.width, probe.height);
      const data = pctx.getImageData(0, 0, probe.width, probe.height).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) ink += 1;
      }
      return ink / (data.length / 4) < 0.004;
    } catch {
      // Reading pixels back is a diagnostic, never a reason to fail the export.
      return false;
    }
  }

  async function buildPdfDrawn(): Promise<{ blob: Blob; filename: string; image?: string } | null> {
    // Fallback renderer: drawn directly with jsPDF primitives (the same
    // approach as the Reports module). Used only if capturing the on-screen
    // preview fails, so exports can never be fully broken.
    const { default: jsPDF } = await import("jspdf");
    // jsPDF cannot resolve a bare path like "/logo.jpg"; it needs the encoded
    // bytes. Without this the fallback silently produced a logo-less document.
    const drawLogo = logoData ?? (await getLogoDataUrl());
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pw - margin * 2;
    let y = 0;

    const drawChrome = () => {
      try {
        pdf.saveGraphicsState?.();
        const G = (pdf as unknown as { GState?: new (o: { opacity: number }) => unknown }).GState;
        if (G)
          (pdf as unknown as { setGState: (g: unknown) => void }).setGState(
            new G({ opacity: 0.05 }),
          );
        if (drawLogo)
          pdf.addImage(drawLogo, "JPEG", pw / 2 - 55, ph / 2 - 55, 110, 110, undefined, "FAST");
        pdf.restoreGraphicsState?.();
      } catch {
        /* watermark is decorative */
      }
      pdf.setFillColor(2, 132, 199);
      pdf.rect(0, 0, pw, 20, "F");
      try {
        if (drawLogo) pdf.addImage(drawLogo, "JPEG", margin, 3.5, 13, 13, undefined, "FAST");
      } catch {
        /* logo optional */
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("STHAIRYA PHYSIOCARE", margin + 17, 9.5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("Resilience \u2022 Firmness \u2022 Balance", margin + 17, 14);
      const bLines = [branch?.name || "", branch?.phone ? `Ph: ${branch.phone}` : ""].filter(
        Boolean,
      );
      bLines.forEach((t, i) => pdf.text(t, pw - margin, 8 + i * 4.5, { align: "right" }));
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(
        "This is a system generated document. A physical signature or stamp is not required.",
        pw / 2,
        ph - 7,
        { align: "center" },
      );
      pdf.setTextColor(0);
      y = 27;
    };

    const ensureRoom = (need: number) => {
      if (y + need > ph - 16) {
        pdf.addPage();
        drawChrome();
      }
    };

    const section = (label: string, value: string) => {
      if (!has(value)) return;
      const lines = pdf.splitTextToSize(value.trim(), contentW) as string[];
      ensureRoom(7 + Math.min(lines.length, 4) * 4.6);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(2, 132, 199);
      pdf.text(label.toUpperCase(), margin, y);
      pdf.setTextColor(0);
      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      lines.forEach((ln) => {
        ensureRoom(5);
        pdf.text(ln, margin, y);
        y += 4.6;
      });
      y += 3;
    };

    drawChrome();

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("PRESCRIPTION", margin, y + 2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Date: ${today}`, pw - margin, y + 2, { align: "right" });
    y += 8;

    pdf.setDrawColor(210);
    pdf.setFillColor(245, 249, 252);
    pdf.roundedRect(margin, y, contentW, 16, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(patient.n || "", margin + 4, y + 6.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      `${patient.pid}   \u2022   ${age} yrs / ${patient.g}   \u2022   ${patient.m || ""}`,
      margin + 4,
      y + 12,
    );
    if (branch?.name) pdf.text(branch.name, pw - margin - 4, y + 6.5, { align: "right" });
    y += 22;

    section("Chief Concern", rx.concern);
    section("Diagnosis", rx.diagnosis);
    section("Manual Therapy", rx.manualTherapy);
    section("Modalities", rx.modalities);
    section("Therapeutic Exercises", rx.exercises);
    section("Advice", rx.advice);

    if (has(rx.reviewDate)) {
      ensureRoom(10);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(2, 132, 199);
      pdf.text("NEXT REVIEW", margin, y);
      pdf.setTextColor(0);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `${fmtDate(rx.reviewDate)}${rx.reviewTime ? ` at ${rx.reviewTime}` : ""}`,
        margin + 34,
        y,
      );
      y += 8;
    }

    if (receiptHasContent) {
      ensureRoom(24);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(2, 132, 199);
      pdf.text(
        `RECEIPT  \u2022  ${savedReceiptNo ?? "Unsaved"}  \u2022  ${receipt.mode}`,
        margin,
        y,
      );
      pdf.setTextColor(0);
      y += 6;
      const cols = [margin, margin + 100, margin + 122, pw - margin];
      pdf.setFontSize(9);
      pdf.text("Description", cols[0], y);
      pdf.text("Qty", cols[1], y);
      pdf.text("Rate", cols[2], y);
      pdf.text("Amount", cols[3], y, { align: "right" });
      pdf.setDrawColor(200);
      pdf.line(margin, y + 1.5, pw - margin, y + 1.5);
      y += 6;
      pdf.setFont("helvetica", "normal");
      for (const it of receipt.items) {
        if (!it.desc.trim()) continue;
        ensureRoom(6);
        const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
        pdf.text(it.desc.slice(0, 54), cols[0], y);
        pdf.text(String(it.qty), cols[1], y);
        pdf.text(String(it.rate), cols[2], y);
        pdf.text(amt.toFixed(2), cols[3], y, { align: "right" });
        y += 5.2;
      }
      pdf.line(margin, y, pw - margin, y);
      y += 5;
      pdf.setFont("helvetica", "bold");
      pdf.text("Total", cols[2], y);
      pdf.text(receiptTotal.toFixed(2), cols[3], y, { align: "right" });
      y += 5;
      if (receipt.paid > 0) {
        pdf.setFont("helvetica", "normal");
        pdf.text("Paid", cols[2], y);
        pdf.text(Number(receipt.paid).toFixed(2), cols[3], y, { align: "right" });
        y += 5;
      }
      if (has(receipt.notes)) section("Receipt Notes", receipt.notes);
    }

    ensureRoom(24);
    y = Math.max(y, ph - 36);
    pdf.setDrawColor(160);
    pdf.line(pw - margin - 52, y + 8, pw - margin, y + 8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(lastVisit?.tN || "Treating Therapist", pw - margin - 26, y + 13, { align: "center" });

    const filename = `PRN_${patient.pid}_${Date.now()}.pdf`;
    return { blob: pdf.output("blob"), filename };
  }

  async function downloadPdf(): Promise<{ blob: Blob; filename: string } | null> {
    if (busy) return null;
    setBusy("pdf");
    toast.loading("Generating PDF...", { id: "pdf" });
    try {
      const out = await buildPdf();
      if (!out) throw new Error("preview missing");
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PDF downloaded", { id: "pdf" });
      return out;
    } catch (err) {
      console.error("PDF error", err);
      toast.error("Failed to generate PDF. Please retry.", { id: "pdf" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  /**
   * "Save, Preview & Print": persists the prescription (+ receipt) to the
   * database, allocating the sequential SP-XXXXXX receipt number, then moves
   * to the preview. Plain "Preview" skips saving.
   */
  async function saveAndPreview() {
    if (saving) return;
    setSaving(true);
    const t = toast.loading("Saving prescription...");
    try {
      const { savePrescription } = await import("@/lib/db.functions");
      const res = await savePrescription({
        data: {
          patientId: patient.id,
          hasReceipt: receiptHasContent && !savedReceiptNo,
          createdBy: lastVisit?.tN || "",
          data: JSON.stringify({
            rx,
            receipt: { ...receipt, no: savedReceiptNo ?? "" },
            receiptOn,
            patient: { id: patient.id, pid: patient.pid, n: patient.n },
            savedAt: Date.now(),
          }),
        },
      });
      if (res.receiptNo) setSavedReceiptNo(res.receiptNo);
      // If the next-review date/time was edited here, write it back to the
      // latest visit so Today's/Upcoming dashboards reflect the change.
      if (
        lastVisit &&
        (rx.reviewDate !== (lastVisit.nxt || "") ||
          (rx.reviewTime || "") !== (lastVisit.nxtTm || ""))
      ) {
        if (rx.reviewDate && rx.reviewDate <= todayIso) {
          toast.error("Next review date must be from tomorrow onwards — visit not updated");
        } else {
          const conflict =
            rx.reviewDate && rx.reviewTime
              ? slotConflict(store.get(), rx.reviewDate, rx.reviewTime, lastVisit.dur || 30)
              : null;
          if (conflict === "overlap") {
            toast.error(
              "Duration exceeds available time before next appointment — visit not updated",
            );
          } else if (conflict === "taken") {
            toast.error("That review time is already booked — visit not updated");
          } else {
            store.updateVisit(lastVisit.id, {
              nxt: rx.reviewDate,
              nxtTm: rx.reviewTime || undefined,
            });
            toast.info("Next review updated on the visit record");
          }
        }
      }
      toast.success(res.receiptNo ? `Saved — Receipt ${res.receiptNo}` : "Prescription saved", {
        id: t,
      });
      setStep("preview");
    } catch (err) {
      console.error("save prescription failed", err);
      toast.error("Couldn't save. Check connection and retry.", { id: t });
    } finally {
      setSaving(false);
    }
  }

  /**
   * Builds a complete, standalone document containing nothing but the captured
   * prescription bitmap, sized to fill exactly one page.
   *
   * Everything else has been tried and failed. Printing the live DOM leaked the
   * app (the toast spinner showed up in the print preview) and could not be
   * pinned to one page across paper sizes. Printing the PDF from an iframe does
   * not work either: Chrome's PDF viewer is a plugin document, so calling
   * print() on it falls through and prints the *parent* page instead — which is
   * exactly the two-pages-plus-toast output that was reported.
   *
   * A plain same-origin HTML document sidesteps both. `height: 100%` with
   * `overflow: hidden` means the image is scaled to fit whatever paper is
   * selected — A4 or Letter — and physically cannot spill onto a second page.
   */
  function buildPrintDocument(image: string): string {
    return [
      "<!doctype html><html><head><meta charset='utf-8'>",
      "<title>Prescription</title><style>",
      "@page{size:A4 portrait;margin:0}",
      "*{margin:0;padding:0;box-sizing:border-box}",
      "html,body{width:100%;height:100%;background:#fff;overflow:hidden}",
      ".sheet{width:100%;height:100%;display:flex;align-items:center;",
      "justify-content:center;overflow:hidden;break-after:avoid;page-break-after:avoid}",
      // 99% rather than 100% so sub-pixel rounding can never tip onto page two.
      ".sheet img{max-width:100%;max-height:99%;width:auto;height:auto;display:block}",
      "</style></head><body><div class='sheet'>",
      `<img src="${image}" alt="Prescription">`,
      "</div></body></html>",
    ].join("");
  }

  /** Waits for the written document's image to decode, then prints it. */
  function printWhenReady(win: Window, onDone?: () => void) {
    const started = Date.now();
    const attempt = () => {
      let ready = true;
      try {
        const img = win.document.images[0];
        ready = !img || (img.complete && img.naturalWidth > 0);
      } catch {
        ready = true;
      }
      if (!ready && Date.now() - started < 8000) {
        setTimeout(attempt, 100);
        return;
      }
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.error("print() failed", err);
      }
      onDone?.();
    };
    setTimeout(attempt, 120);
  }

  function printViaIframe(html: string): boolean {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) {
      frame.remove();
      return false;
    }
    doc.open();
    doc.write(html);
    doc.close();
    printWhenReady(win, () => setTimeout(() => frame.remove(), 60000));
    return true;
  }

  async function printRx() {
    if (busy) return;

    // Safari only honours a window opened synchronously inside the click
    // handler, so the tab is claimed before any awaiting begins.
    const viaWindow = isAppleWebKit();
    const preOpened = viaWindow ? window.open("", "_blank") : null;
    if (preOpened) {
      preOpened.document.write(
        "<!doctype html><title>Prescription</title>" +
          "<body style='font:15px system-ui;padding:24px;color:#334'>Preparing prescription...",
      );
    }

    setBusy("print");
    toast.loading("Preparing prescription...", { id: "print" });
    try {
      const out = await buildPdf();
      if (!out?.image) throw new Error("no printable capture");
      const html = buildPrintDocument(out.image);

      // Dismissed before printing so the spinner can never be captured into
      // the print preview, which is what happened previously.
      toast.dismiss("print");

      if (preOpened) {
        preOpened.document.open();
        preOpened.document.write(html);
        preOpened.document.close();
        printWhenReady(preOpened);
        return;
      }
      if (!printViaIframe(html)) throw new Error("could not open a print document");
    } catch (err) {
      console.error("Print error", err);
      preOpened?.close();
      toast.dismiss("print");
      // Never fall back to printing the app page — that is the original bug.
      // Hand over the PDF instead so the prescription can still be printed.
      const out = await buildPdf().catch(() => null);
      if (out) {
        const url = URL.createObjectURL(out.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = out.filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.info("Couldn't open the print dialog — the PDF was downloaded instead.", {
          duration: 7000,
        });
      } else {
        toast.error("Couldn't prepare the prescription for printing. Please retry.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto print:bg-white print:overflow-visible">
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4 print:p-0">
        <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl my-4 sm:my-8 print:my-0 print:shadow-none print:rounded-none relative">
          {/* Sticky close button — always visible */}
          <button
            onClick={onClose}
            aria-label="Close prescription"
            title="Close"
            className="print:hidden absolute -top-3 -right-3 sm:top-3 sm:right-3 z-20 size-10 rounded-full bg-destructive text-white shadow-lg grid place-items-center hover:scale-105 transition-transform border-2 border-white"
          >
            <X className="size-5" />
          </button>

          {historical && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs sm:text-sm flex items-center gap-2 print:hidden">
              <History className="size-4 shrink-0" />
              Viewing a saved record from {fmtDate(new Date(historical.savedAt))} — downloading or
              sending WhatsApp uses this saved version; saving again creates a new history entry.
            </div>
          )}

          {/* Header / stepper — hidden in print */}
          <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-3 flex-wrap print:hidden pr-12 sm:pr-16">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold text-base sm:text-lg truncate">
                Prescription · {patient.pid}
              </h2>
              <div className="hidden sm:flex items-center gap-1 ml-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full ${step === "edit" ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}
                >
                  1 · Content
                </span>
                <span className="text-muted-foreground">→</span>
                <span
                  className={`px-2 py-0.5 rounded-full ${step === "preview" ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}
                >
                  2 · Preview
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {step === "edit" ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setStep("preview")}>
                    <Eye className="size-4" /> Preview
                  </Button>
                  <Button
                    size="sm"
                    className="brand-gradient text-white border-0"
                    disabled={saving}
                    onClick={saveAndPreview}
                  >
                    <Save className="size-4" /> {saving ? "Saving..." : "Save, Preview & Print"}{" "}
                    <ArrowRight className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setStep("edit")}>
                    <ArrowLeft className="size-4" /> <Pencil className="size-4" /> Back to Content
                  </Button>
                  {debugOn && (
                    <div className="w-full mb-2 rounded-md border border-amber-300 bg-amber-50 p-2 font-mono text-[11px] leading-4 text-amber-900">
                      <div className="font-semibold">rxdebug &middot; {BUILD_ID}</div>
                      {diag.length === 0 ? (
                        <div>Run Download or Print, then screenshot this box.</div>
                      ) : (
                        diag.map((line) => <div key={line}>{line}</div>)
                      )}
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={printRx} disabled={!!busy}>
                    <Printer className="size-4" /> {busy === "print" ? "Preparing..." : "Print"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadPdf()}
                    disabled={!!busy}
                  >
                    <Download className="size-4" />{" "}
                    {busy === "pdf" ? "Generating..." : "Download PDF"}
                  </Button>
                  <Button
                    size="sm"
                    className="wa-btn border-0 bg-[#25D366] text-white hover:bg-[#128C7E] hover:text-white"
                    onClick={sendWhatsApp}
                    disabled={!!busy || sharing}
                  >
                    <WhatsAppIcon size={16} /> {sharing ? "Preparing..." : "Send via WhatsApp"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Step 1 — Content form */}
          {step === "edit" && (
            <div className="p-4 sm:p-6 print:hidden">
              <p className="text-xs text-muted-foreground mb-4">
                All fields are optional. Empty sections won't appear in the printed prescription.
              </p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <Label>To Whomsoever It May Concern</Label>
                  <Textarea
                    rows={3}
                    value={rx.concern}
                    onChange={(e) => setRx({ ...rx, concern: e.target.value })}
                    placeholder="e.g. fitness certificate, referral note, employer letter"
                  />
                </div>
                <div>
                  <Label>Diagnosis</Label>
                  <Input
                    value={rx.diagnosis}
                    onChange={(e) => setRx({ ...rx, diagnosis: e.target.value })}
                  />
                </div>
                <div>
                  <Label>℞ Manual Therapy</Label>
                  <Input
                    value={rx.manualTherapy}
                    onChange={(e) => setRx({ ...rx, manualTherapy: e.target.value })}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label>Electrotherapy / Modalities</Label>
                  <Textarea
                    rows={2}
                    value={rx.modalities}
                    onChange={(e) => setRx({ ...rx, modalities: e.target.value })}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label>Exercise Protocol</Label>
                  <Textarea
                    rows={5}
                    value={rx.exercises}
                    onChange={(e) => setRx({ ...rx, exercises: e.target.value })}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label>Advice</Label>
                  <Textarea
                    rows={3}
                    value={rx.advice}
                    onChange={(e) => setRx({ ...rx, advice: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Next Review Date</Label>
                  <Input
                    type="date"
                    min={todayIso}
                    value={rx.reviewDate}
                    onChange={(e) => setRx({ ...rx, reviewDate: e.target.value, reviewTime: "" })}
                  />
                </div>
                <div>
                  <Label>Next Review Time</Label>
                  <select
                    className="w-full h-9 px-3 rounded-md border bg-background"
                    value={rx.reviewTime}
                    onChange={(e) => setRx({ ...rx, reviewTime: e.target.value })}
                    disabled={!rx.reviewDate}
                  >
                    <option value="">— None —</option>
                    {reviewSlots.map((s) => (
                      <option key={s} value={s} disabled={reviewTaken.includes(s)}>
                        {fmtTime12(s)}
                        {reviewTaken.includes(s) ? " — booked" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Receipt (optional) */}
              <div className="mt-6 border rounded-xl p-4 bg-surface/50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptOn}
                    onChange={(e) => setReceiptOn(e.target.checked)}
                    className="size-4"
                  />
                  <Receipt className="size-4 text-brand" />
                  <span className="font-semibold text-sm">Include Payment Receipt (optional)</span>
                </label>
                {receiptOn && (
                  <div className="mt-4 space-y-3">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div>
                        <Label>Receipt No. (assigned on save)</Label>
                        <Input value={savedReceiptNo ?? "SP-______"} readOnly disabled />
                      </div>
                      <div>
                        <Label>Payment Mode</Label>
                        <select
                          className="w-full h-9 px-3 rounded-md border bg-background"
                          value={receipt.mode}
                          onChange={(e) => setReceipt({ ...receipt, mode: e.target.value })}
                        >
                          {["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Insurance"].map(
                            (m) => (
                              <option key={m}>{m}</option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
                        <Label>Amount Paid (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={receipt.paid || ""}
                          onChange={(e) =>
                            setReceipt({ ...receipt, paid: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Services / Charges</Label>
                        <div className="flex flex-wrap gap-1">
                          {SERVICE_PRESETS.slice(0, 5).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => addReceiptItem(s)}
                              className="text-[11px] px-2 py-1 rounded-full bg-brand/10 text-brand hover:bg-brand/20"
                            >
                              + {s}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => addReceiptItem("")}
                            className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-accent inline-flex items-center gap-1"
                          >
                            <Plus className="size-3" /> Custom
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {receipt.items.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No items added yet. Use the quick buttons above.
                          </p>
                        )}
                        {receipt.items.map((it) => (
                          <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                            <Input
                              className="col-span-12 sm:col-span-6"
                              placeholder="Service description"
                              value={it.desc}
                              onChange={(e) => updateReceiptItem(it.id, { desc: e.target.value })}
                            />
                            <Input
                              className="col-span-4 sm:col-span-2"
                              type="number"
                              min={1}
                              placeholder="Qty"
                              value={it.qty || ""}
                              onChange={(e) =>
                                updateReceiptItem(it.id, { qty: Number(e.target.value) || 0 })
                              }
                            />
                            <Input
                              className="col-span-5 sm:col-span-3"
                              type="number"
                              min={0}
                              placeholder="Rate (₹)"
                              value={it.rate || ""}
                              onChange={(e) =>
                                updateReceiptItem(it.id, { rate: Number(e.target.value) || 0 })
                              }
                            />
                            <button
                              type="button"
                              onClick={() => removeReceiptItem(it.id)}
                              title="Remove"
                              className="col-span-3 sm:col-span-1 h-9 grid place-items-center rounded-md hover:bg-destructive/10 text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {receipt.items.length > 0 && (
                        <div className="text-right text-sm font-semibold mt-2">
                          Total: ₹ {receiptTotal.toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea
                        rows={2}
                        value={receipt.notes}
                        onChange={(e) => setReceipt({ ...receipt, notes: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  className="brand-gradient text-white border-0"
                  onClick={() => setStep("preview")}
                >
                  <Eye className="size-4" /> Preview
                </Button>
                <Button
                  className="brand-gradient text-white border-0"
                  disabled={saving}
                  onClick={saveAndPreview}
                >
                  <Save className="size-4" /> {saving ? "Saving..." : "Save, Preview & Print"}{" "}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — A4 preview */}
          {step === "preview" && (
            <div className="p-2 sm:p-4 bg-muted print:p-0 print:bg-white overflow-x-auto">
              <div
                ref={ref}
                className="rx-sheet relative bg-white text-black p-8 pb-24 mx-auto shadow-sm print:shadow-none"
                style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}
              >
                <div
                  className="absolute inset-0 grid place-items-center pointer-events-none"
                  aria-hidden
                >
                  <img
                    data-rx-logo="watermark"
                    src={logoSrc}
                    alt=""
                    className="w-[420px] h-[420px] object-contain"
                    style={{ opacity: 0.07 }}
                  />
                </div>

                <div className="relative flex items-start justify-between border-b-2 border-[#0284c7] pb-4">
                  <div className="flex items-center gap-4">
                    {/* `ring-*` compiles to a box-shadow, which Safari renders
                        as a detached light-blue crescent when the sheet is
                        rasterised. A real border is visually identical and
                        rasterises correctly on every engine. */}
                    <img
                      data-rx-logo="header"
                      src={logoSrc}
                      alt="Logo"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[#cce6f4] shrink-0"
                    />
                    <div>
                      <div className="text-2xl font-bold text-[#0c4a6e] leading-tight">
                        STHAIRYA PHYSIOCARE
                      </div>
                      <div className="text-[10px] tracking-[0.25em] text-[#0284c7] uppercase">
                        Resilience · Firmness · Balance
                      </div>
                      {branch && (
                        <>
                          {/* Branch name with its registration number alongside,
                              so the credential reads as belonging to the branch
                              rather than sitting among the contact details. */}
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-xs text-gray-700 font-semibold">
                              {branch.name}
                            </span>
                            {branch.license && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                <ScrollText
                                  className="size-3 shrink-0 text-[#0284c7]"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Registration / License number:</span>
                                <span>Reg. {branch.license}</span>
                              </span>
                            )}
                          </div>

                          {/* Contact rows. Each label is replaced by an icon that
                              carries the same meaning, with the wording kept as
                              screen-reader-only text so nothing is lost. */}
                          <div className="text-xs text-gray-600 mt-0.5 space-y-0.5">
                            <div className="flex items-start gap-1.5">
                              <MapPin
                                className="size-3 shrink-0 mt-[2px] text-[#0284c7]"
                                aria-hidden="true"
                              />
                              <span className="sr-only">Address:</span>
                              <span>{branch.address}</span>
                            </div>

                            {/* Phone and email share a line; the website gets its
                                own so long URLs never push the two apart. */}
                            <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                              <span className="inline-flex items-center gap-1.5">
                                <Phone
                                  className="size-3 shrink-0 text-[#0284c7]"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Phone:</span>
                                <a
                                  ref={setLinkRef("phone")}
                                  href={`tel:${branch.phone.replace(/[^0-9+]/g, "")}`}
                                  className="text-inherit no-underline hover:underline"
                                >
                                  {branch.phone}
                                </a>
                              </span>

                              {branchEmail && (
                                <>
                                  <span className="text-gray-300">|</span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Mail
                                      className="size-3 shrink-0 text-[#0284c7]"
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">Email:</span>
                                    <a
                                      ref={setLinkRef("email")}
                                      href={mailtoLink(
                                        branchEmail,
                                        ENQUIRY_SUBJECT,
                                        ENQUIRY_MESSAGE,
                                      )}
                                      className="text-inherit no-underline hover:underline"
                                    >
                                      {branchEmail}
                                    </a>
                                  </span>
                                </>
                              )}
                            </div>

                            {branchWeb && (
                              <div className="flex items-center gap-1.5">
                                <Globe
                                  className="size-3 shrink-0 text-[#0284c7]"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Website:</span>
                                <a
                                  ref={setLinkRef("web")}
                                  href={absoluteUrl(branchWeb)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-inherit no-underline hover:underline break-all"
                                >
                                  {branchWeb}
                                </a>
                              </div>
                            )}

                            {settings.globalUrl && settings.globalUrl !== branchWeb && (
                              <div className="flex items-center gap-1.5">
                                <Globe
                                  className="size-3 shrink-0 text-[#0284c7]"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Website:</span>
                                <a
                                  ref={setLinkRef("globalUrl")}
                                  href={absoluteUrl(settings.globalUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#0284c7] underline underline-offset-2 break-all"
                                >
                                  {settings.globalUrl}
                                </a>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs" style={{ marginRight: "48px" }}>
                    <div className="font-semibold">Date</div>
                    <div>{today}</div>
                  </div>
                </div>

                <div className="relative mt-5 grid grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-gray-500 uppercase">Patient ID</div>
                    <div className="font-mono">{patient.pid}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500 uppercase">Name</div>
                    <div className="font-medium">{patient.n}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500 uppercase">Age / Sex</div>
                    <div>
                      {age} / {patient.g}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500 uppercase">Mobile</div>
                    <div>{patient.m}</div>
                  </div>
                </div>

                <div className="relative mt-6 space-y-4 text-sm">
                  {has(rx.concern) && (
                    <Section title="To Whomsoever It May Concern">
                      <pre className="font-sans whitespace-pre-wrap">{rx.concern}</pre>
                    </Section>
                  )}
                  {has(rx.diagnosis) && <Section title="Diagnosis">{rx.diagnosis}</Section>}
                  {has(rx.manualTherapy) && (
                    <Section title="℞ Manual Therapy">{rx.manualTherapy}</Section>
                  )}
                  {has(rx.modalities) && (
                    <Section title="Electrotherapy / Modalities">{rx.modalities}</Section>
                  )}
                  {has(rx.exercises) && (
                    <Section title="Exercise Protocol">
                      <pre className="font-sans whitespace-pre-wrap">{rx.exercises}</pre>
                    </Section>
                  )}
                  {has(rx.advice) && <Section title="Advice">{rx.advice}</Section>}
                  {has(rx.reviewDate) && (
                    <Section title="Next Review">
                      {fmtDate(rx.reviewDate)}
                      {rx.reviewTime ? ` · ${fmtTime12(rx.reviewTime)}` : ""}
                    </Section>
                  )}

                  {receiptHasContent && (
                    <div className="mt-2 border border-[#0284c7]/40 rounded-md overflow-hidden">
                      <div className="bg-[#0284c7]/10 px-3 py-2 flex items-center justify-between">
                        <div className="text-[11px] font-bold text-[#0c4a6e] uppercase tracking-wider">
                          Payment Receipt
                        </div>
                        <div className="text-[11px] text-gray-700">
                          <span className="font-semibold">Receipt #</span>{" "}
                          {savedReceiptNo ?? "— assigned on save —"} &nbsp;·&nbsp;
                          <span className="font-semibold">Mode:</span> {receipt.mode}
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-1.5">Service</th>
                            <th className="text-right px-3 py-1.5 w-20">Sessions</th>
                            <th className="text-right px-3 py-1.5 w-24">Rate (₹)</th>
                            <th className="text-right px-3 py-1.5 w-28">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receipt.items
                            .filter((i) => i.desc.trim())
                            .map((it) => (
                              <tr key={it.id} className="border-t">
                                <td className="px-3 py-1.5">{it.desc}</td>
                                <td className="px-3 py-1.5 text-right">{it.qty}</td>
                                <td className="px-3 py-1.5 text-right">
                                  {it.rate.toLocaleString("en-IN")}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  {(it.qty * it.rate).toLocaleString("en-IN")}
                                </td>
                              </tr>
                            ))}
                          <tr className="border-t bg-gray-50 font-semibold">
                            <td className="px-3 py-1.5" colSpan={3}>
                              Total
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              ₹ {receiptTotal.toLocaleString("en-IN")}
                            </td>
                          </tr>
                          <tr className="border-t">
                            <td
                              className="px-3 py-1.5 text-[11px] italic text-gray-600"
                              colSpan={4}
                            >
                              Total in words: {amountInWordsINR(receiptTotal)}
                            </td>
                          </tr>
                          {receipt.paid > 0 && (
                            <tr className="border-t">
                              <td className="px-3 py-1.5" colSpan={3}>
                                Amount Paid
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                ₹ {receipt.paid.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          )}
                          {receipt.paid > 0 && receiptTotal - receipt.paid !== 0 && (
                            <tr className="border-t">
                              <td className="px-3 py-1.5" colSpan={3}>
                                {receiptTotal - receipt.paid > 0 ? "Balance Due" : "Change"}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                ₹ {Math.abs(receiptTotal - receipt.paid).toLocaleString("en-IN")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {receipt.notes && (
                        <div className="px-3 py-2 text-[11px] text-gray-700 border-t bg-gray-50">
                          {receipt.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer note — locked to the absolute bottom of the A4 page */}
                <div className="rx-footer absolute inset-x-8 bottom-6 pt-4 border-t border-dashed border-gray-300 text-center text-[11px] text-gray-600 italic">
                  Note: This is a system generated document. A physical signature or stamp is not
                  required.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-[#0c4a6e] uppercase tracking-wider mb-1">
        {title}
      </div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}
