import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Code2, Mail, Rocket, Send } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { whatsappLink, mailtoLink } from "@/lib/contactLinks";

export const Route = createFileRoute("/developer")({
  head: () => ({
    meta: [
      { title: "Vaishak Rao Shuntipady — Digital Craftsman" },
      {
        name: "description",
        content: "Turning ideas into apps, and data into insight.",
      },
    ],
  }),
  component: DeveloperPage,
});

const DEV_NAME = "Vaishak Rao Shuntipady";
const DEV_TITLE = "Digital Craftsman";
const DEV_CAPTION = "Turning ideas into apps, and data into insight.";
const DEV_WHATSAPP_DIGITS = "918197339371"; // +91 8197339371
const DEV_EMAIL = "vaishak.srao@gmail.com";
const DEV_MESSAGE =
  "Hi Vaishak! I came across your work through the Sthairya Physiocare website and I'd like to talk about a web/app development project.";

/**
 * Real brand SVG marks (not lucide's generic glyphs) so each badge reads as
 * the actual platform logo, on that platform's own colour — X's mark is
 * specifically white-on-black to match its real app icon, not a generic
 * circle like the others.
 */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.53 17.52 2.04 12 2.04S2 6.53 2 12.06c0 5 3.66 9.13 8.44 9.88v-6.99H7.9v-2.89h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.89h-2.34v6.99C18.34 21.19 22 17.06 22 12.06z" />
    </svg>
  );
}
function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 2c-2.72 0-3.06.01-4.12.06-1.06.05-1.79.22-2.43.47-.66.26-1.22.6-1.77 1.16-.56.55-.9 1.11-1.16 1.77-.25.64-.42 1.37-.47 2.43C2 8.94 2 9.28 2 12s.01 3.06.06 4.12c.05 1.06.22 1.79.47 2.43.26.66.6 1.22 1.16 1.77.55.56 1.11.9 1.77 1.16.64.25 1.37.42 2.43.47C8.94 22 9.28 22 12 22s3.06-.01 4.12-.06c1.06-.05 1.79-.22 2.43-.47.66-.26 1.22-.6 1.77-1.16.56-.55.9-1.11 1.16-1.77.25-.64.42-1.37.47-2.43.05-1.06.06-1.4.06-4.12s-.01-3.06-.06-4.12c-.05-1.06-.22-1.79-.47-2.43-.26-.66-.6-1.22-1.16-1.77-.55-.56-1.11-.9-1.77-1.16-.64-.25-1.37-.42-2.43-.47C15.06 2.01 14.72 2 12 2zm0 1.8c2.67 0 2.99.01 4.04.06.98.04 1.5.21 1.86.34.47.18.8.4 1.15.75.35.35.57.68.75 1.15.13.36.29.88.34 1.86.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.04.98-.21 1.5-.34 1.86-.18.47-.4.8-.75 1.15-.35.35-.68.57-1.15.75-.36.13-.88.3-1.86.34-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-.98-.04-1.5-.21-1.86-.34-.47-.18-.8-.4-1.15-.75-.35-.35-.57-.68-.75-1.15-.13-.36-.3-.88-.34-1.86C3.81 14.99 3.8 14.67 3.8 12s.01-2.99.06-4.04c.04-.98.21-1.5.34-1.86.18-.47.4-.8.75-1.15.35-.35.68-.57 1.15-.75.36-.13.88-.3 1.86-.34C9.01 3.81 9.33 3.8 12 3.8zm0 3.05a5.15 5.15 0 100 10.3 5.15 5.15 0 000-10.3zm0 8.5a3.35 3.35 0 110-6.7 3.35 3.35 0 010 6.7zm5.36-8.7a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z" />
    </svg>
  );
}
function LinkedInMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.86 0-2.15 1.45-2.15 2.94v5.66H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    key: "x",
    label: "X",
    href: "https://x.com/Nibhruth_a",
    Icon: XMark,
    bg: "#000000",
  },
  {
    key: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/share/19bCAFEhnf/",
    Icon: FacebookMark,
    bg: "#1877F2",
  },
  {
    key: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/vaishak_rao_s?igsi=end6MmJ4bXVjbTNi",
    Icon: InstagramMark,
    bg: "linear-gradient(135deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/vaishak-shuntipady?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app",
    Icon: LinkedInMark,
    bg: "#0A66C2",
  },
] as const;

function DeveloperPage() {
  const sceneRef = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--dc-mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--dc-my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }

  return (
    <div
      ref={sceneRef}
      onMouseMove={handleMouseMove}
      className="dc-scene relative min-h-screen overflow-hidden"
    >
      <div className="dc-aura" aria-hidden="true" />
      <div className="dc-grid" aria-hidden="true" />
      <div className="dc-particles" aria-hidden="true">
        {["1", "0", "1", "0", "1", "0", "1", "0"].map((digit, i) => (
          <span key={i} className={`dc-particle dc-particle-${i}`}>
            {digit}
          </span>
        ))}
      </div>

      <main className="dc-in relative z-[1] mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-8 px-6 py-16 sm:px-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
          {/* Identity */}
          <div className="flex flex-col sm:w-[46%] sm:shrink-0">
            <div className="relative w-fit">
              <div className="dc-avatar grid size-24 place-items-center rounded-full">
                <Code2 className="dc-avatar-icon size-11 text-white" strokeWidth={2.2} />
              </div>
              <span className="dc-online-dot absolute bottom-1 right-1 size-5 rounded-full border-2 border-[#0a0d12]" />
            </div>
            <h1 className="dc-name mt-6 whitespace-nowrap text-2xl font-bold text-white sm:text-[1.9rem]">
              {DEV_NAME}
            </h1>
            <p className="dc-subtitle mt-1 text-base font-medium">{DEV_TITLE}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">{DEV_CAPTION}</p>

            <div className="mt-6 flex items-center gap-2.5">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="dc-social grid size-10 place-items-center rounded-full text-white transition-transform"
                  style={{ background: s.bg }}
                >
                  <s.Icon />
                </a>
              ))}
              <a
                href={whatsappLink(DEV_WHATSAPP_DIGITS, DEV_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                title="WhatsApp"
                className="dc-social grid size-10 place-items-center rounded-full text-white transition-transform"
                style={{ background: "#25D366" }}
              >
                <WhatsAppIcon size={17} />
              </a>
              <a
                href={mailtoLink(DEV_EMAIL, "Project enquiry", DEV_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Email"
                title="Email"
                className="dc-social grid size-10 place-items-center rounded-full text-white transition-transform"
                style={{ background: "linear-gradient(135deg, #EA4335, #FBBC05)" }}
              >
                <Mail className="size-4" />
              </a>
            </div>
          </div>

          {/* Contact — email only, per request */}
          <DeveloperContactForm />
        </div>
      </main>

      <style>{`
        .dc-scene {
          background: #0a0d12;
        }
        .dc-in { animation: dc-page-in .6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes dc-page-in {
          0% { opacity: 0; transform: translateY(14px) scale(.98); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        .dc-aura {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(
            720px circle at var(--dc-mx, 50%) var(--dc-my, 35%),
            rgba(45, 212, 191, 0.16), rgba(56, 189, 248, 0.10) 35%, transparent 65%
          );
          animation: dc-aura-pulse 6s ease-in-out infinite;
        }
        @keyframes dc-aura-pulse { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }

        .dc-grid {
          position: absolute; inset: -20%; z-index: 0; pointer-events: none; opacity: .1;
          background-image:
            linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: dc-grid-drift 20s linear infinite;
        }
        @keyframes dc-grid-drift { 0% { transform: translate(0,0); } 100% { transform: translate(40px,40px); } }

        .dc-particles { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .dc-particle {
          position: absolute; font: 12px/1 monospace; color: rgba(45,212,191,0.3);
          animation: dc-particle-float 11s ease-in-out infinite;
        }
        .dc-particle-0 { left: 5%;  top: 90%; animation-delay: 0s; }
        .dc-particle-1 { left: 16%; top: 95%; animation-delay: 1.6s; }
        .dc-particle-2 { left: 30%; top: 88%; animation-delay: 3.2s; }
        .dc-particle-3 { left: 47%; top: 93%; animation-delay: 4.8s; }
        .dc-particle-4 { left: 62%; top: 89%; animation-delay: 6.4s; }
        .dc-particle-5 { left: 76%; top: 94%; animation-delay: 8s; }
        .dc-particle-6 { left: 88%; top: 90%; animation-delay: 9.6s; }
        .dc-particle-7 { left: 95%; top: 96%; animation-delay: 2.4s; }
        @keyframes dc-particle-float {
          0% { transform: translateY(0); opacity: 0; }
          15% { opacity: .55; } 85% { opacity: .25; }
          100% { transform: translateY(-140px); opacity: 0; }
        }

        .dc-avatar {
          background: linear-gradient(135deg, #2dd4bf, #38bdf8);
          box-shadow: 0 0 0 4px rgba(45,212,191,0.15), 0 0 34px -4px rgba(45,212,191,0.6);
        }
        .dc-avatar-icon { animation: dc-avatar-pulse 3.2s ease-in-out infinite; }
        @keyframes dc-avatar-pulse {
          0%, 100% { opacity: .85; filter: drop-shadow(0 0 0 rgba(255,255,255,0)); transform: scale(1); }
          50% { opacity: 1; filter: drop-shadow(0 0 10px rgba(255,255,255,0.65)); transform: scale(1.08); }
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

        .dc-name { text-shadow: 0 0 24px rgba(56,189,248,0.25); }
        .dc-subtitle { color: rgba(45,212,191,0.85); }

        .dc-social { border: 1px solid rgba(255,255,255,0.12); }
        .dc-social:hover {
          box-shadow: 0 0 18px -2px rgba(45,212,191,0.5);
          transform: translateY(-3px) scale(1.06);
        }

        @media (prefers-reduced-motion: reduce) {
          .dc-in, .dc-aura, .dc-grid, .dc-particle, .dc-avatar-icon, .dc-online-dot { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function DeveloperContactForm() {
  const [formName, setFormName] = useState("");
  const [formMessage, setFormMessage] = useState("");

  function composedMessage() {
    const who = formName.trim() ? `My name is ${formName.trim()}. ` : "";
    const typedMessage = formMessage.trim();
    if (typedMessage) return `Hi Vaishak! ${who}${typedMessage}`;
    const GREETING = "Hi Vaishak! ";
    return who ? `${GREETING}${who}${DEV_MESSAGE.slice(GREETING.length)}` : DEV_MESSAGE;
  }

  return (
    <div className="dc-formcol-wrap flex-1 rounded-2xl p-[1px]">
      <div className="dc-formcol flex h-full flex-col gap-3 rounded-2xl p-5 sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="dc-form-icon grid size-7 place-items-center rounded-lg">
            <Rocket className="size-3.5" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Start a project
          </p>
        </div>
        <input
          type="text"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="Your name"
          className="dc-input w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30"
        />
        <textarea
          value={formMessage}
          onChange={(e) => setFormMessage(e.target.value)}
          placeholder="Tell me a little about what you need built..."
          rows={5}
          className="dc-input w-full flex-1 resize-none rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30"
        />
        <a
          href={mailtoLink(DEV_EMAIL, "Project enquiry", composedMessage())}
          target="_blank"
          rel="noopener noreferrer"
          className="dc-send-mail mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
        >
          <Send className="size-4" /> Send via Email
        </a>
      </div>
      <style>{`
        .dc-formcol-wrap {
          background: linear-gradient(120deg, rgba(45,212,191,0.5), rgba(56,189,248,0.15), rgba(45,212,191,0.5));
          background-size: 200% 200%;
          animation: dc-border-flow 6s ease-in-out infinite;
        }
        @keyframes dc-border-flow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .dc-formcol { background: #0d1117; }
        .dc-form-icon { background: rgba(45,212,191,0.12); color: #5eead4; }
        .dc-input { background: rgba(255,255,255,0.03); border: 1px solid rgba(56,189,248,0.22); outline: none; }
        .dc-input:focus { border-color: rgba(45,212,191,0.7); box-shadow: 0 0 0 3px rgba(45,212,191,0.15); }
        .dc-send-mail { background: linear-gradient(135deg, #38bdf8, #2dd4bf); }
        .dc-send-mail:hover { box-shadow: 0 0 18px -3px rgba(56,189,248,0.6); }
        @media (prefers-reduced-motion: reduce) {
          .dc-formcol-wrap { animation: none; }
        }
      `}</style>
    </div>
  );
}
