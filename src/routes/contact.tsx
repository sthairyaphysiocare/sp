import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC, enabledBranches, whatsappDigits } from "@/lib/logo";
import { useStore } from "@/lib/store";
import { MapPin, Phone, Mail, Clock, ExternalLink } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
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
  const settings = useStore((s) => s.settings);
  const branches = enabledBranches(settings);
  const wa = whatsappDigits(settings);
  const primary = branches[0];

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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">Visit Us</h3>
                  <div className="mt-3 space-y-4">
                    {branches.map((b) => (
                      <div key={b.id}>
                        <div className="text-sm font-medium">{b.name}</div>
                        <p className="text-sm text-muted-foreground mt-0.5">{b.address}</p>
                        {b.mapUrl && (
                          <a href={b.mapUrl} target="_blank" rel="noreferrer"
                             className="inline-flex items-center gap-1 text-sm text-brand mt-1 hover:underline">
                            View on Google Maps <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-lg brand-gradient grid place-items-center text-white shrink-0"><Phone className="size-5" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold">Call</h3>
                  <div className="mt-2 space-y-1">
                    {branches.map((b) => (
                      <p key={b.id} className="text-sm">
                        <span className="text-muted-foreground">{b.name}:</span>{" "}
                        <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="text-brand hover:underline">{b.phone}</a>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-card border">
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-lg bg-emerald-500 grid place-items-center text-white shrink-0"><WhatsAppIcon size={20} /></div>
                <div>
                  <h3 className="font-semibold">WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mt-1">Quick replies, 7 days a week.</p>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline mt-1">
                    Chat with us
                  </a>
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
                  <p className="text-sm text-muted-foreground mt-1">Monday – Friday: 9:00 AM – 1:00 PM &amp; 4:00 PM – 8:00 PM</p>
                  <p className="text-sm text-muted-foreground">Saturday: 9:00 AM – 1:00 PM</p>
                  <p className="text-sm text-muted-foreground">Sunday: By appointment</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border bg-card min-h-[400px]">
            <iframe
              title="Clinic Location"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(primary?.address || CLINIC.mapRef)}&output=embed`}
              className="w-full h-full min-h-[400px] border-0"
              loading="lazy"
            />
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"><WhatsAppIcon size={16} /> WhatsApp Now</Button>
          </a>
          <a href={`tel:+${wa}`}>
            <Button variant="outline"><Phone className="size-4" /> Call</Button>
          </a>
          <a href={`mailto:${CLINIC.email}`}>
            <Button variant="outline"><Mail className="size-4" /> Send Email</Button>
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
