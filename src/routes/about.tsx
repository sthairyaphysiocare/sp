import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC } from "@/lib/logo";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `About — ${CLINIC.name}` },
      { name: "description", content: "About Sthairya Physiocare — our mission, philosophy, and team." },
      { property: "og:title", content: `About — ${CLINIC.name}` },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicLayout>
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold">About Sthairya</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Sthairya — meaning <em>resilience, firmness and balance</em> — captures our approach
          to physiotherapy. We blend evidence based musculoskeletal rehabilitation with
          compassionate, individualised care.
        </p>
        <div className="mt-10 space-y-6 text-foreground/90 leading-relaxed">
          <p>
            Our clinic serves patients across age groups from athletes recovering from sports
            injuries to seniors regaining mobility after joint replacement. We specialise in
            musculoskeletal disorders, sports medicine, neurological rehabilitation and post
            operative recovery.
          </p>
          <p>
            Every patient receives a structured assessment, personalised treatment plan and
            measurable progress tracking. Our therapists use manual therapy, electrotherapy
            modalities, taping techniques, and targeted exercise prescriptions to restore
            function and reduce pain.
          </p>
          <p>
            We believe physiotherapy should empower you not just to recover, but to live
            stronger, move freer and prevent future injury.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-3 gap-5">
          {[
            { t: "Mission", d: "Restore movement, reduce pain and rebuild confidence in every patient." },
            { t: "Vision", d: "Be the most trusted physiotherapy partner in Puttur and beyond." },
            { t: "Values", d: "Integrity, evidence, empathy and measurable outcomes." },
          ].map((x) => (
            <div key={x.t} className="p-6 rounded-2xl bg-card border">
              <h3 className="font-semibold text-brand">{x.t}</h3>
              <p className="text-sm text-muted-foreground mt-2">{x.d}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
