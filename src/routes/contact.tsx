import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC } from "@/lib/logo";
import { MapPin, Phone, Mail, MessageCircle, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function ContactPage() {
  const mapUrl = CLINIC.mapUrl;
  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold">Get in Touch</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          We're here to answer your questions and schedule your visit.
        </p>

        <div className="mt-10 grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-card border">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><MapPin className="size-5" /></div>
                <div className="min-w-0">
                  <h3 className="font-semibold">Visit Us</h3>
                  <p className="text-sm text-muted-foreground mt-1">{CLINIC.name}, {CLINIC.address}</p>
                  <p className="text-xs text-muted-foreground mt-1">Map: {CLINIC.mapRef}</p>
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand mt-2 hover:underline">
                    Open in Google Maps <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-card border">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><Phone className="size-5" /></div>
                <div>
                  <h3 className="font-semibold">Call / WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mt-1">{CLINIC.phone}</p>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-card border">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><Mail className="size-5" /></div>
                <div className="min-w-0">
                  <h3 className="font-semibold">Email</h3>
                  <p className="text-sm text-muted-foreground mt-1 break-all">{CLINIC.email}</p>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-card border">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><Clock className="size-5" /></div>
                <div>
                  <h3 className="font-semibold">Clinic Hours</h3>
                  <p className="text-sm text-muted-foreground mt-1">Mon – Sat: 8:00 AM – 8:00 PM</p>
                  <p className="text-sm text-muted-foreground">Sun: By appointment</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border bg-card min-h-[400px]">
            <iframe
              title="Clinic Location"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(CLINIC.mapRef)}&output=embed`}
              className="w-full h-full min-h-[400px] border-0"
              loading="lazy"
            />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href={`https://wa.me/${CLINIC.whatsapp}`} target="_blank" rel="noreferrer">
            <Button className="brand-gradient text-white border-0"><MessageCircle className="size-4" /> WhatsApp Now</Button>
          </a>
          <a href={`mailto:${CLINIC.email}`}>
            <Button variant="outline"><Mail className="size-4" /> Send Email</Button>
          </a>
          <a href={`tel:${CLINIC.phone}`}>
            <Button variant="outline"><Phone className="size-4" /> Call</Button>
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
