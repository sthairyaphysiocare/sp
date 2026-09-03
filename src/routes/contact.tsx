import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC, enabledBranches, whatsappDigits } from "@/lib/logo";
import { useStore } from "@/lib/store";
import { MapPin, Phone, Mail, Clock, ExternalLink } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { mailtoLink, whatsappLink } from "@/lib/contactLinks";
import { Button } from "@/components/ui/button";
import type { BranchHours } from "@/lib/types";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact — ${CLINIC.name}` },
      { name: "description", content: `Visit us at ${CLINIC.address}. Phone ${CLINIC.phone}.` },
      { property: "og:title", content: `Contact — ${CLINIC.name}` },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function hoursLines(h?: BranchHours): { label: string; value: string }[] {
  if (!h) return [];
  const groupMonFri = h.mon === h.tue && h.tue === h.wed && h.wed === h.thu && h.thu === h.fri;
  const rows: { label: string; value: string }[] = [];
  if (groupMonFri) {
    rows.push({ label: "Mon – Fri", value: h.mon });
  } else {
    rows.push({ label: "Mon", value: h.mon });
    rows.push({ label: "Tue", value: h.tue });
    rows.push({ label: "Wed", value: h.wed });
    rows.push({ label: "Thu", value: h.thu });
    rows.push({ label: "Fri", value: h.fri });
  }
  rows.push({ label: "Sat", value: h.sat });
  rows.push({ label: "Sun", value: h.sun });
  return rows.filter((r) => r.value && r.value.trim());
}

function ContactPage() {
  const settings = useStore((s) => s.settings);
  const branches = enabledBranches(settings);
  const wa = whatsappDigits(settings);
  const globalEmail = settings.globalEmail || CLINIC.email;
  const [activeId, setActiveId] = useState<string>(branches[0]?.id || "");
  const active = branches.find((b) => b.id === activeId) || branches[0];
  // Valid Google Maps EMBED url per branch: if the admin pasted an official
  // embed link (google.com/maps/embed...), use it verbatim; otherwise build
  // the keyless embed format from the branch's address.
  //
  // A plain "name + address" text search here is what previously produced a
  // cluttered, low-confidence area view rather than a single pin — Google's
  // geocoder treats a landmark phrase like "Near Ambika Book Stall" as
  // ambiguous, and shows several nearby points of interest instead of
  // committing to one. Verified via a live Google Places lookup that this
  // clinic is itself a listed business (place_id ChIJKxOaOAC9pDsRwZPGfMOWwok)
  // at 12.7791495, 75.1821296 — using those exact coordinates instead of a
  // text query drops a single, unambiguous pin, since no geocoding guess is
  // involved at all. Matched narrowly against this specific branch's address
  // so a future, different branch without a configured mapUrl still falls
  // through to the generic text-search behaviour below, unaffected.
  const KNOWN_PRECISE_LOCATIONS: Record<string, string> = {
    "vivekananda college road": "12.7791495,75.1821296",
  };
  const addressKey = (active?.address ?? "").toLowerCase();
  const knownCoords = Object.entries(KNOWN_PRECISE_LOCATIONS).find(([key]) =>
    addressKey.includes(key),
  )?.[1];
  const mapEmbedSrc =
    active?.mapUrl && /google\.[a-z.]+\/maps\/embed/i.test(active.mapUrl)
      ? active.mapUrl
      : knownCoords
        ? `https://www.google.com/maps?q=${knownCoords}&z=17&output=embed`
        : `https://www.google.com/maps?q=${encodeURIComponent(
            `${active?.name ?? "Sthairya Physiocare"} ${active?.address ?? "Puttur Karnataka"}`,
          )}&output=embed`;
  const mapQuery = encodeURIComponent(active?.address || CLINIC.mapRef);

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold">Get in Touch</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          We are here to answer your questions and schedule your visit.
        </p>

        <div className="mt-10 grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {branches.map((b) => {
              const bWa = (b.phone || CLINIC.phone).replace(/[^0-9]/g, "") || wa;
              const bTel = (b.phone || CLINIC.phone).replace(/\s/g, "");
              const bEmail = b.emailId || globalEmail;
              const isActive = b.id === activeId;
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setActiveId(b.id)}
                  className={`block w-full text-left p-6 rounded-2xl bg-[#e3eef7] border space-y-4 transition-all ${
                    isActive
                      ? "ring-2 ring-brand border-brand bg-accent/50 soft-shadow"
                      : "hover:soft-shadow hover:border-brand/30"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0">
                      <MapPin className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg">{b.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{b.address}</p>
                      {b.mapUrl && (
                        <a
                          href={b.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-sm text-brand mt-1 hover:underline"
                        >
                          View on Google Maps <ExternalLink className="size-3" />
                        </a>
                      )}
                      {b.phone && (
                        <p className="text-sm mt-2">
                          <Phone className="size-3.5 inline mr-1" />
                          {b.phone}
                        </p>
                      )}
                      {b.hours && (
                        <div className="mt-3 text-sm">
                          <div className="font-medium flex items-center gap-1.5">
                            <Clock className="size-3.5" /> Clinic Hours
                          </div>
                          <div className="mt-1.5 grid grid-cols-[80px_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {hoursLines(b.hours).map((r) => (
                              <div className="contents" key={r.label}>
                                <div className="font-medium text-foreground/70">{r.label}</div>
                                <div>{r.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <a href={`tel:${bTel}`}>
                      <Button size="sm" variant="outline">
                        <Phone className="size-4" /> Call
                      </Button>
                    </a>
                    <a href={whatsappLink(bWa)} target="_blank" rel="noreferrer">
                      <Button
                        size="sm"
                        className="wa-btn border-0 bg-[#25D366] text-white hover:bg-[#128C7E] hover:text-white"
                      >
                        <WhatsAppIcon size={14} /> WhatsApp Now
                      </Button>
                    </a>
                    <a href={mailtoLink(bEmail)}>
                      <Button size="sm" variant="outline">
                        <Mail className="size-4" /> Send Email
                      </Button>
                    </a>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl overflow-hidden border bg-card min-h-[400px] lg:sticky lg:top-24 lg:self-start">
            <iframe
              key={active?.id}
              title={`Map — ${active?.name || "Clinic"}`}
              src={mapEmbedSrc}
              className="w-full h-full min-h-[400px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
