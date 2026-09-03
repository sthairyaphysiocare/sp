import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Code2, Facebook, Instagram, Linkedin, Mail, Send, X as XIcon } from "lucide-react";
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
            <h1 className="dc-name mt-6 text-3xl font-bold text-white sm:text-4xl">{DEV_NAME}</h1>
            <p className="dc-subtitle mt-1 text-base font-medium">{DEV_TITLE}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">{DEV_CAPTION}</p>

            <div className="mt-6 flex items-center gap-2">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="dc-social grid size-10 place-items-center rounded-full transition-all"
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
                className="dc-social grid size-10 place-items-center rounded-full transition-all"
              >
                <WhatsAppIcon size={16} />
              </a>
              <a
                href={mailtoLink(DEV_EMAIL, "Project enquiry", DEV_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Email"
                title="Email"
                className="dc-social grid size-10 place-items-center rounded-full transition-all"
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
          0%, 100% { opacity: .85; filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
          50% { opacity: 1; filter: drop-shadow(0 0 10px rgba(255,255,255,0.65)); }
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

        .dc-social {
          color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .dc-social:hover {
          color: #5eead4; border-color: rgba(45,212,191,0.55);
          box-shadow: 0 0 16px -2px rgba(45,212,191,0.6);
          transform: translateY(-2px);
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
    <div className="dc-formcol flex flex-1 flex-col gap-3 rounded-xl p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Start a project</p>
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
        className="dc-input w-full resize-none rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30"
      />
      <a
        href={mailtoLink(DEV_EMAIL, "Project enquiry", composedMessage())}
        target="_blank"
        rel="noopener noreferrer"
        className="dc-send-mail mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
      >
        <Send className="size-4" /> Send via Email
      </a>
      <style>{`
        .dc-formcol { background: rgba(255,255,255,0.02); border: 1px solid rgba(56,189,248,0.14); }
        .dc-input { background: rgba(255,255,255,0.03); border: 1px solid rgba(56,189,248,0.22); outline: none; }
        .dc-input:focus { border-color: rgba(45,212,191,0.7); box-shadow: 0 0 0 3px rgba(45,212,191,0.15); }
        .dc-send-mail { background: linear-gradient(135deg, #38bdf8, #2dd4bf); }
        .dc-send-mail:hover { box-shadow: 0 0 18px -3px rgba(56,189,248,0.6); }
      `}</style>
    </div>
  );
}
