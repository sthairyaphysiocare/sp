import { useEffect, useRef, useState } from "react";
import { Phone, Mail, MessageCircle, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { CLINIC, whatsappDigits } from "@/lib/logo";
import { cn } from "@/lib/utils";

/**
 * Floating contact button (public site only). Expands into three actions:
 * Call and WhatsApp target the Global WhatsApp number from Admin settings;
 * Email targets the Global Email ID.
 */
export function ContactFab() {
  const settings = useStore((s) => s.settings);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const wa = whatsappDigits(settings);
  const email = settings.globalEmail || CLINIC.email;
  const message = encodeURIComponent(
    "Hello Sthairya Physiocare, I'd like to know more about your services.",
  );

  // Close when tapping anywhere else or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const actions = [
    {
      key: "call",
      label: "Call us",
      href: `tel:+${wa}`,
      icon: <Phone className="size-5" />,
      bg: "bg-sky-500 hover:bg-sky-600",
    },
    {
      key: "wa",
      label: "WhatsApp us",
      href: `https://wa.me/${wa}?text=${message}`,
      icon: <MessageCircle className="size-5" />,
      bg: "bg-emerald-500 hover:bg-emerald-600",
      external: true,
    },
    {
      key: "mail",
      label: "Email us",
      href: `mailto:${email}`,
      icon: <Mail className="size-5" />,
      bg: "bg-violet-500 hover:bg-violet-600",
    },
  ];

  return (
    <div
      ref={rootRef}
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden"
    >
      {/* Action icons — staggered spring reveal */}
      {actions.map((a, i) => (
        <a
          key={a.key}
          href={a.href}
          target={a.external ? "_blank" : undefined}
          rel={a.external ? "noopener noreferrer" : undefined}
          aria-label={a.label}
          title={a.label}
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          onClick={() => setOpen(false)}
          style={{ transitionDelay: open ? `${i * 55}ms` : `${(actions.length - 1 - i) * 40}ms` }}
          className={cn(
            "group relative grid place-items-center size-11 rounded-full text-white shadow-lg",
            "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            a.bg,
            open
              ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
              : "translate-y-4 opacity-0 scale-50 pointer-events-none",
          )}
        >
          {a.icon}
          <span className="absolute right-full mr-3 px-2 py-1 rounded-md bg-foreground text-background text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none">
            {a.label}
          </span>
        </a>
      ))}

      {/* Main toggle */}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close contact options" : "Contact us"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid place-items-center size-14 rounded-full text-white brand-gradient shadow-xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 active:scale-95",
          open && "rotate-45",
        )}
      >
        <Plus className="size-6" />
        {/* idle attention pulse */}
        {!open && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full brand-gradient opacity-40 animate-ping [animation-duration:2.6s]"
          />
        )}
      </button>
    </div>
  );
}
