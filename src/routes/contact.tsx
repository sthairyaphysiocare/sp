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
      { title: `Contact - ${CLINIC.name}` },
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
  // the keyless embed format below.
  //
  // Identify the branch as a BUSINESS, not as a point on the map. This is what
  // makes Google render its own native info card (the white panel with the
  // business name, address and a directions button) rather than a bare pin:
  // a raw lat/lng pair is just a coordinate, so Google has nothing to show a
  // card about, which is why the previous coordinate-based embed produced a
  // pin with no card. A place ID names the actual listing, so Google draws the
  // card itself from its own data.
  //
  // Place ID verified via a live Google Places lookup for this clinic. Google's
  // embed syntax requires the `place_id:` prefix. Coordinates are kept as the
  // second choice: they still put the pin in exactly the right spot for a
  // branch that has no place ID recorded, just without the card.
  const KNOWN_PLACE_IDS: Record<string, string> = {
    "vivekananda college road": "ChIJKxOaOAC9pDsRwZPGfMOWwok",
  };
  const KNOWN_PRECISE_LOCATIONS: Record<string, string> = {
    "vivekananda college road": "12.7791495,75.1821296",
  };
  const addressKey = (active?.address ?? "").toLowerCase();
  const matchKey = (map: Record<string, string>) =>
    Object.entries(map).find(([key]) => addressKey.includes(key))?.[1];
  const knownPlaceId = matchKey(KNOWN_PLACE_IDS);
  const knownCoords = matchKey(KNOWN_PRECISE_LOCATIONS);
  const mapEmbedSrc =
    active?.mapUrl && /google\.[a-z.]+\/maps\/embed/i.test(active.mapUrl)
      ? active.mapUrl
      : knownPlaceId
        ? `https://www.google.com/maps?q=place_id:${knownPlaceId}&z=17&output=embed`
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
                      <Button
                        size="sm"
                        className="border-0 bg-[#135788] text-white hover:bg-[#0f4569] hover:text-white"
                      >
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

          <div className="relative rounded-2xl overflow-hidden border bg-card min-h-[400px] lg:sticky lg:top-24 lg:self-start">
            <iframe
              key={active?.id}
              title={`Map - ${active?.name || "Clinic"}`}
              src={mapEmbedSrc}
              className="w-full h-full min-h-[400px] border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />

            {/*
              Fallback location card, rendered over the map.

              The embed above now identifies the branch by place ID, so Google
              renders its OWN native info card for branches it can resolve --
              that is the card in the reference screenshot, drawn by Google
              from its own listing data, which is not something this page can
              produce or style. This element is the fallback beneath that: it
              only renders for a branch with no place ID recorded, where
              Google shows a bare pin and no card at all.

              Deliberately positioned bottom-left, clear of the top-left corner
              Google uses for its own card, so the two cannot collide if a
              future Google change starts rendering a card for a branch this
              did not expect.

              Everything in it comes from the active branch's own configured
              record, with the same fallbacks used by the branch list above, so
              a branch added later is picked up automatically with no work
              here. pointer-events-none on the wrapper keeps the map fully
              draggable underneath; the card itself re-enables them so its own
              link stays clickable.
            */}
            {active && !knownPlaceId && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <div className="pointer-events-auto max-w-[19rem] rounded-lg bg-white shadow-[0_2px_6px_rgba(0,0,0,0.3)] overflow-hidden">
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#EA4335]/10">
                        <MapPin className="size-4 text-[#EA4335]" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-[#202124]">
                          {CLINIC.name}
                          {active.name ? ` - ${active.name}` : ""}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-[#5f6368]">{active.address}</p>
                        {active.phone && (
                          <p className="mt-1 text-xs text-[#5f6368]">{active.phone}</p>
                        )}
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1a73e8] hover:underline"
                        >
                          View larger map <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
