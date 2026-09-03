import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Facebook, Instagram, Linkedin, Mail, Send, X as XIcon } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { whatsappLink, mailtoLink } from "@/lib/contactLinks";

/**
 * Standalone "Developed by" credit — pill button in the footer that opens a
 * profile card on click. Deliberately self-contained: every style this file
 * needs lives in the <style> block below, under a single `dc-` (developer
 * credit) namespace, and nothing here is added to the site's shared
 * styles.css. The intent is that this entire file could be deleted with zero
 * trace left anywhere else in the codebase.
 *
 * The card's palette is intentionally NOT the site's brand colours — a
 * separate, personal-brand dark/neon aesthetic, as requested.
 *
 * All contact values below are real, as given directly, not placeholders.
 * One thing worth knowing if this ever needs revisiting: the LinkedIn link
 * points at the same URL as Instagram — given that way explicitly, more than
 * once, not an assumption made by this file.
 */

const DEV_NAME = "Vaishak Rao Shuntipady";
const DEV_TITLE = "Digital Craftsman";
const DEV_INITIALS = "VS";
const DEV_WHATSAPP_DIGITS = "918197339371"; // +91 8197339371
const DEV_EMAIL = "vaishak.srao@gmail.com";
const DEV_MESSAGE =
  "Hi Vaishak! I came across your work through the Sthairya Physiocare website and I'd like to talk about a web/app development project.";
const TECH_STACK = ["React", "TypeScript", "Node.js", "Tailwind CSS"];

const SOCIAL_LINKS = [
  { key: "x", label: "X", href: "https://x.com/Nibhruth_a", icon: XIcon },
  {
    key: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/share/19bCAFEhnf/",
    icon: Facebook,
  },
  {
    key: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/vaishak_rao_s?igsi=end6MmJ4bXVjbTNi",
    icon: Instagram,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    href: "https://www.instagram.com/vaishak_rao_s?igsi=end6MmJ4bXVjbTNi",
    icon: Linkedin,
  },
] as const;

export function DeveloperCredit() {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [formName, setFormName] = useState("");
  const [formMessage, setFormMessage] = useState("");

  // Close on outside click / Escape — same pattern used elsewhere in this
  // app for dismissible overlays.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Mouse-tracked aura: written directly to a CSS custom property via the DOM
  // ref rather than React state, so the glow can follow the cursor smoothly
  // without a re-render on every pointer move.
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--dc-mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--dc-my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  function composedMessage() {
    const who = formName.trim() ? `My name is ${formName.trim()}. ` : "";
    const typedMessage = formMessage.trim();
    if (typedMessage) return `Hi Vaishak! ${who}${typedMessage}`;
    // No typed message — DEV_MESSAGE already opens with its own greeting, so
    // reuse it rather than prepend a second one. Splice the name in right
    // after that known, fixed prefix instead.
    const GREETING = "Hi Vaishak! ";
    return who ? `${GREETING}${who}${DEV_MESSAGE.slice(GREETING.length)}` : DEV_MESSAGE;
  }

  return (
    <div ref={wrapRef} className="dc-root relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="dc-pill group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-background/60 hover:text-background transition-colors"
      >
        <span className="dc-pill-glow" aria-hidden="true" />
        <span className="relative">
          Developed by <span className="font-semibold">Vaishak Rao Shuntipady</span>
        </span>
        <ArrowUpRight className="relative size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>

      {open && (
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          role="dialog"
          aria-label={`${DEV_NAME} — developer profile`}
          className="dc-card dc-card-in absolute bottom-full right-0 mb-3 w-[min(92vw,640px)] overflow-hidden rounded-2xl text-left"
        >
          <div className="dc-aura" aria-hidden="true" />
          <div className="dc-grid" aria-hidden="true" />
          <div className="dc-particles" aria-hidden="true">
            {["1", "0", "1", "0", "1", "0"].map((digit, i) => (
              <span key={i} className={`dc-particle dc-particle-${i}`}>
                {digit}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="dc-close absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <XIcon className="size-4" />
          </button>

          <div className="relative z-[1] flex flex-col gap-6 p-6 sm:flex-row sm:p-7">
            {/* Left: identity */}
            <div className="flex flex-col sm:w-[46%] sm:shrink-0">
              <div className="relative w-fit">
                <div className="dc-avatar grid size-16 place-items-center rounded-full text-lg font-bold text-white">
                  {DEV_INITIALS}
                </div>
                <span className="dc-online-dot absolute bottom-0 right-0 size-4 rounded-full border-2 border-[#0a0d12]" />
              </div>
              <h3 className="dc-name mt-4 text-lg font-semibold text-white">{DEV_NAME}</h3>
              <p className="dc-subtitle text-sm">{DEV_TITLE}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {TECH_STACK.map((t) => (
                  <span key={t} className="dc-tag rounded-full px-2.5 py-1 text-[11px] font-medium">
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="dc-social grid size-9 place-items-center rounded-full transition-all"
                  >
                    <s.icon className="size-4" />
                  </a>
                ))}
                <a
                  href={whatsappLink(DEV_WHATSAPP_DIGITS, DEV_MESSAGE)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  title="WhatsApp"
                  className="dc-social grid size-9 place-items-center rounded-full transition-all"
                >
                  <WhatsAppIcon size={16} />
                </a>
                <a
                  href={
                    DEV_EMAIL ? mailtoLink(DEV_EMAIL, "Project enquiry", DEV_MESSAGE) : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!DEV_EMAIL}
                  aria-label="Email"
                  title={DEV_EMAIL ? "Email" : "Email (not yet configured)"}
                  className="dc-social grid size-9 place-items-center rounded-full transition-all aria-disabled:opacity-30 aria-disabled:pointer-events-none"
                >
                  <Mail className="size-4" />
                </a>
              </div>
            </div>

            {/* Right: quick project-enquiry form. No backend involved — on
                send it simply opens WhatsApp / email with the typed message
                already filled in. */}
            <div className="dc-formcol flex flex-1 flex-col gap-3 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                Start a project
              </p>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Your name"
                className="dc-input w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
              <textarea
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Tell me a little about what you need built..."
                rows={3}
                className="dc-input w-full resize-none rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
              <div className="mt-1 flex gap-2">
                <a
                  href={whatsappLink(DEV_WHATSAPP_DIGITS, composedMessage())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dc-send-btn dc-send-wa inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-transform active:scale-95"
                >
                  <WhatsAppIcon size={14} /> WhatsApp
                </a>
                <a
                  href={
                    DEV_EMAIL
                      ? mailtoLink(DEV_EMAIL, "Project enquiry", composedMessage())
                      : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!DEV_EMAIL}
                  className="dc-send-btn dc-send-mail aria-disabled:opacity-40 aria-disabled:pointer-events-none inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-transform active:scale-95"
                >
                  <Send className="size-3.5" /> Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dc-pill { position: relative; isolation: isolate; }
        .dc-pill-glow {
          position: absolute; inset: -6px -10px; border-radius: 999px;
          background: radial-gradient(circle, rgba(45,212,191,0.35), transparent 70%);
          opacity: 0; transition: opacity .35s ease; z-index: -1;
        }
        .dc-pill:hover .dc-pill-glow { opacity: 1; }

        @keyframes dc-card-spring {
          0% { opacity: 0; transform: scale(.85) translateY(10px); }
          60% { opacity: 1; transform: scale(1.03) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .dc-card-in { animation: dc-card-spring .55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        .dc-card {
          background: rgba(10, 13, 18, 0.82);
          backdrop-filter: blur(22px) saturate(140%);
          -webkit-backdrop-filter: blur(22px) saturate(140%);
          border: 1px solid rgba(45, 212, 191, 0.18);
          box-shadow:
            0 0 0 1px rgba(56, 189, 248, 0.06),
            0 20px 60px -15px rgba(0, 0, 0, 0.7),
            0 0 40px -8px rgba(45, 212, 191, 0.25);
        }

        .dc-aura {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(
            420px circle at var(--dc-mx, 50%) var(--dc-my, 30%),
            rgba(45, 212, 191, 0.16), rgba(56, 189, 248, 0.10) 35%, transparent 65%
          );
          transition: background-position .2s ease;
          animation: dc-aura-pulse 6s ease-in-out infinite;
        }
        @keyframes dc-aura-pulse {
          0%, 100% { opacity: .75; }
          50% { opacity: 1; }
        }

        .dc-grid {
          position: absolute; inset: -20%; z-index: 0; pointer-events: none; opacity: .12;
          background-image:
            linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px);
          background-size: 34px 34px;
          animation: dc-grid-drift 18s linear infinite;
        }
        @keyframes dc-grid-drift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(34px, 34px); }
        }

        .dc-particles { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .dc-particle {
          position: absolute; font: 10px/1 monospace; color: rgba(45,212,191,0.35);
          animation: dc-particle-float 9s ease-in-out infinite;
        }
        .dc-particle-0 { left: 8%;  top: 85%; animation-delay: 0s; }
        .dc-particle-1 { left: 22%; top: 90%; animation-delay: 1.4s; }
        .dc-particle-2 { left: 45%; top: 82%; animation-delay: 2.8s; }
        .dc-particle-3 { left: 63%; top: 92%; animation-delay: 4.2s; }
        .dc-particle-4 { left: 80%; top: 84%; animation-delay: 5.6s; }
        .dc-particle-5 { left: 92%; top: 90%; animation-delay: 7s; }
        @keyframes dc-particle-float {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: .6; }
          85% { opacity: .3; }
          100% { transform: translateY(-90px); opacity: 0; }
        }

        .dc-avatar {
          background: linear-gradient(135deg, #2dd4bf, #38bdf8);
          box-shadow: 0 0 0 3px rgba(45,212,191,0.15), 0 0 24px -4px rgba(45,212,191,0.55);
        }
        .dc-online-dot {
          background: #34d399;
          box-shadow: 0 0 0 2px rgba(52,211,153,0.25), 0 0 10px 2px rgba(52,211,153,0.8);
          animation: dc-dot-pulse 1.8s ease-in-out infinite;
        }
        @keyframes dc-dot-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(52,211,153,0.25), 0 0 8px 2px rgba(52,211,153,0.7); }
          50% { box-shadow: 0 0 0 4px rgba(52,211,153,0.15), 0 0 16px 5px rgba(52,211,153,0.95); }
        }

        .dc-name { text-shadow: 0 0 20px rgba(56,189,248,0.25); }
        .dc-subtitle { color: rgba(45,212,191,0.85); }

        .dc-tag {
          color: #99f6e4;
          background: rgba(45,212,191,0.08);
          border: 1px solid rgba(45,212,191,0.25);
        }

        .dc-social {
          color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .dc-social:hover {
          color: #5eead4;
          border-color: rgba(45,212,191,0.55);
          box-shadow: 0 0 16px -2px rgba(45,212,191,0.6);
          transform: translateY(-2px);
        }

        .dc-formcol {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(56,189,248,0.14);
        }
        .dc-input {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(56,189,248,0.22);
          outline: none;
        }
        .dc-input:focus {
          border-color: rgba(45,212,191,0.7);
          box-shadow: 0 0 0 3px rgba(45,212,191,0.15);
        }

        .dc-send-wa { background: linear-gradient(135deg, #25D366, #128C7E); }
        .dc-send-wa:hover { box-shadow: 0 0 18px -3px rgba(37,211,102,0.7); }
        .dc-send-mail { background: linear-gradient(135deg, #38bdf8, #2dd4bf); }
        .dc-send-mail:hover { box-shadow: 0 0 18px -3px rgba(56,189,248,0.6); }

        @media (prefers-reduced-motion: reduce) {
          .dc-card-in, .dc-aura, .dc-grid, .dc-particle, .dc-online-dot { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
