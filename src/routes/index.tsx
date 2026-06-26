import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { LOGO_URL, CLINIC } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import {
  Activity, HeartPulse, Dumbbell, Stethoscope, ShieldCheck, Sparkles,
  MapPin, Phone, Mail, MessageCircle, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const SPECS = [
  { icon: Activity, title: "Back & Neck Pain", desc: "Targeted relief for spinal and postural dysfunction." },
  { icon: HeartPulse, title: "Post-Operative Rehab", desc: "Structured recovery after TKR, ACL, and shoulder surgery." },
  { icon: Dumbbell, title: "Sports Injuries", desc: "Performance-driven rehabilitation for athletes." },
  { icon: Stethoscope, title: "Frozen Shoulder", desc: "Manual therapy and progressive ROM restoration." },
];

const STATS = [
  { label: "Patients Treated", value: "5,000+" },
  { label: "Years of Practice", value: "10+" },
  { label: "Recovery Rate", value: "94%" },
  { label: "Specialised Programs", value: "20+" },
];

function HomePage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 brand-gradient opacity-[0.04]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-brand text-xs font-semibold mb-5">
              <Sparkles className="size-3.5" /> {CLINIC.tagline}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05]">
              Move better. <span className="text-brand-gradient">Live stronger.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              At Sthairya Physiocare, evidence-based physiotherapy meets personalised recovery —
              from sports injuries to post-surgical rehab, right here in Puttur.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/book">
                <Button size="lg" className="brand-gradient text-white border-0">
                  Book a Visit <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href={`https://wa.me/${CLINIC.whatsapp}`} target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline">
                  <MessageCircle className="size-4" /> WhatsApp
                </Button>
              </a>
            </div>
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl sm:text-3xl font-bold text-brand">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 brand-gradient opacity-10 blur-3xl rounded-full" />
            <div className="relative aspect-square max-w-md mx-auto rounded-3xl bg-card soft-shadow border p-8 grid place-items-center">
              <img
                src={LOGO_URL}
                alt={`${CLINIC.name} logo`}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Specialities */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Our Specialities</h2>
            <p className="mt-3 text-muted-foreground">
              Comprehensive physiotherapy programs tailored to your recovery journey.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SPECS.map((s) => (
              <div key={s.title} className="p-6 rounded-2xl bg-card border hover:soft-shadow transition-all hover:-translate-y-1">
                <div className="size-12 rounded-xl brand-gradient grid place-items-center text-white mb-4">
                  <s.icon className="size-5" />
                </div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/specialities"><Button variant="outline">View all specialities <ArrowRight className="size-4" /></Button></Link>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="py-16 sm:py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, t: "Evidence-Based Care", d: "Protocols backed by latest clinical research and outcome tracking." },
            { icon: HeartPulse, t: "Personalised Plans", d: "Every recovery plan is tailored to your goals and lifestyle." },
            { icon: Activity, t: "Progress You See", d: "Visual dashboards track pain reduction and functional recovery." },
          ].map((x) => (
            <div key={x.t} className="p-6 rounded-2xl bg-card border">
              <x.icon className="size-8 text-brand" />
              <h3 className="mt-4 font-semibold text-xl">{x.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 rounded-3xl brand-gradient text-white p-8 sm:p-12 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-3xl font-bold">Ready to start your recovery?</h2>
            <p className="mt-3 text-white/90">Reach out and our team will schedule your first session.</p>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-start gap-3"><MapPin className="size-4 mt-0.5 shrink-0" /><span>{CLINIC.address}</span></div>
              <div className="flex items-center gap-3"><Phone className="size-4 shrink-0" /><span>{CLINIC.phone}</span></div>
              <div className="flex items-center gap-3"><Mail className="size-4 shrink-0" /><span className="break-all">{CLINIC.email}</span></div>
            </div>
          </div>
          <div className="flex flex-col gap-3 justify-center">
            <Link to="/book"><Button size="lg" className="w-full bg-white text-brand hover:bg-white/90 border-0">Book Online</Button></Link>
            <a href={`https://wa.me/${CLINIC.whatsapp}`} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="w-full bg-transparent border-white text-white hover:bg-white/10">
                <MessageCircle className="size-4" /> Chat on WhatsApp
              </Button>
            </a>
            <a href={`mailto:${CLINIC.email}`}>
              <Button size="lg" variant="outline" className="w-full bg-transparent border-white text-white hover:bg-white/10">
                <Mail className="size-4" /> Email Us
              </Button>
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
