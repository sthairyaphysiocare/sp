import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC, enabledBranches, whatsappDigits } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { getIcon } from "@/lib/icons";
import {
  Activity, HeartPulse, ShieldCheck, Sparkles, MapPin, Phone, Mail, ArrowRight,
  ExternalLink, Feather, Sun, Award, GraduationCap, Clock, User,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const settings = useStore((s) => s.settings);
  const branches = enabledBranches(settings);
  const wa = whatsappDigits(settings);
  const stats = [
    { label: "Patients Treated", value: settings.stats.patients },
    { label: "Years of Practice", value: settings.stats.years },
    { label: "Recovery Rate", value: settings.stats.recovery },
    { label: "Specialised Programs", value: settings.stats.programs },
  ];

  const taglines = [
    { icon: Feather, text: "Relieve the pain." },
    { icon: Activity, text: "Restore the movement." },
    { icon: Sun, text: "Renew your life." },
  ];

  return (
    <PublicLayout>
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
              At Sthairya Physiocare, evidence based practice meets personalized care. Whether
              you are managing complex musculoskeletal disorders, recovering from a sports
              injury, rehabilitating after surgery or overcoming everyday mobility challenges,
              we are dedicated to helping you live a pain free life.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/book">
                <Button size="lg" className="brand-gradient text-white border-0">
                  Book a Visit <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline">
                  <WhatsAppIcon size={16} /> WhatsApp
                </Button>
              </a>
            </div>
            {settings.publicStatsEnabled && (
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
                {stats.map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl sm:text-3xl font-bold text-brand">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <div className="absolute -inset-8 brand-gradient opacity-10 blur-3xl rounded-full hidden lg:block" />
            <ul className="relative space-y-5 sm:space-y-6">
              {taglines.map((t, i) => (
                <li
                  key={t.text}
                  className="flex items-center gap-4 opacity-0 animate-[fadeUp_0.7s_ease-out_forwards]"
                  style={{ animationDelay: `${i * 180}ms` }}
                >
                  <span className="shrink-0 size-12 rounded-2xl brand-gradient grid place-items-center text-white soft-shadow">
                    <t.icon className="size-6" />
                  </span>
                  <span className="text-2xl sm:text-3xl font-display font-semibold tracking-tight">
                    {t.text}
                  </span>
                </li>
              ))}
            </ul>
            <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Our Specialities</h2>
            <p className="mt-3 text-muted-foreground">
              Comprehensive physiotherapy programs tailored to your recovery journey.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {settings.specialities.slice(0, 4).map((s) => {
              const Icon = getIcon(s.icon);
              return (
                <div key={s.id} className="p-6 rounded-2xl bg-card border hover:soft-shadow transition-all hover:-translate-y-1">
                  <div className="size-12 rounded-xl brand-gradient grid place-items-center text-white mb-4">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{s.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-10">
            <Link to="/specialities"><Button variant="outline">View all specialities <ArrowRight className="size-4" /></Button></Link>
          </div>
        </div>
      </section>

      {settings.cliniciansEnabled && settings.clinicians.length > 0 && (
        <section className="py-16 sm:py-20 bg-surface/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">Clinical Expertise</h2>
              <p className="mt-3 text-muted-foreground">In expert hands.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              {settings.clinicians.map((c) => (
                <article
                  key={c.id}
                  className="w-full sm:w-[300px] p-6 rounded-2xl bg-card border soft-shadow transition-transform duration-300 hover:scale-[1.03]"
                >
                  <div className="mx-auto size-24 rounded-full bg-brand/10 grid place-items-center overflow-hidden ring-2 ring-brand/20">
                    {c.photo ? (
                      <img src={c.photo} alt={c.name || "Clinician"} className="w-full h-full object-cover" />
                    ) : (
                      <User className="size-12 text-brand" />
                    )}
                  </div>
                  {c.name && (
                    <h3 className="mt-4 text-center font-semibold text-lg">{c.name}</h3>
                  )}
                  <div className="mt-3 space-y-2 text-sm">
                    {c.qualification && (
                      <div className="flex items-center gap-2 text-foreground/80">
                        <GraduationCap className="size-4 text-brand shrink-0" />
                        <span>{c.qualification}</span>
                      </div>
                    )}
                    {c.experience && (
                      <div className="flex items-center gap-2 text-foreground/80">
                        <Clock className="size-4 text-brand shrink-0" />
                        <span>{c.experience}</span>
                      </div>
                    )}
                    {c.speciality && (
                      <div className="flex items-center gap-2 text-foreground/80">
                        <Award className="size-4 text-brand shrink-0" />
                        <span>{c.speciality}</span>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, t: "Evidence-Based Care", d: "Protocols backed by latest clinical research and outcome tracking." },
            { icon: HeartPulse, t: "Personalised Plans", d: "Every recovery plan is tailored to your goals and lifestyle." },
            { icon: Activity, t: "Progress You See", d: "Proactively tracking pain reduction and functional recovery." },
          ].map((x) => (
            <div key={x.t} className="p-6 rounded-2xl bg-card border">
              <x.icon className="size-8 text-brand" />
              <h3 className="mt-4 font-semibold text-xl">{x.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 rounded-3xl brand-gradient text-white p-8 sm:p-12 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-3xl font-bold">Ready to start your recovery?</h2>
            <p className="mt-3 text-white/90">Reach out and our team will schedule your first session.</p>
            <div className="mt-6 space-y-3 text-sm">
              {branches.map((b) => (
                <div key={b.id} className="flex items-start gap-3">
                  <MapPin className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{b.name}</div>
                    {b.mapUrl && (
                      <a href={b.mapUrl} target="_blank" rel="noreferrer"
                         className="inline-flex items-center gap-1 underline-offset-2 hover:underline text-white/90">
                        View on Google Maps <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <div className="text-white/80 text-xs mt-0.5">{b.phone}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3"><Mail className="size-4 shrink-0" /><span className="break-all">{CLINIC.email}</span></div>
            </div>
          </div>
          <div className="flex flex-col gap-3 justify-center">
            <Link to="/book"><Button size="lg" className="w-full bg-white text-brand hover:bg-white/90 border-0">Book Online</Button></Link>
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="w-full bg-transparent border-white text-white hover:bg-white/10">
                <WhatsAppIcon size={16} /> Chat on WhatsApp
              </Button>
            </a>
            <a href={`tel:+${wa}`}>
              <Button size="lg" variant="outline" className="w-full bg-transparent border-white text-white hover:bg-white/10">
                <Phone className="size-4" /> Call
              </Button>
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
