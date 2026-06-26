import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC } from "@/lib/logo";
import {
  Activity, HeartPulse, Dumbbell, Stethoscope, Bone, Brain, Baby, Footprints,
} from "lucide-react";

export const Route = createFileRoute("/specialities")({
  head: () => ({
    meta: [
      { title: `Specialities — ${CLINIC.name}` },
      { name: "description", content: "Treatments offered: back pain, frozen shoulder, sports injuries, post-op rehab, neurological care." },
      { property: "og:title", content: `Specialities — ${CLINIC.name}` },
      { property: "og:url", content: "/specialities" },
    ],
    links: [{ rel: "canonical", href: "/specialities" }],
  }),
  component: SpecialitiesPage,
});

const ITEMS = [
  { icon: Activity, t: "Back & Neck Pain", d: "Manual therapy, traction, postural correction, and targeted core strengthening for cervical and lumbar dysfunction." },
  { icon: Stethoscope, t: "Frozen Shoulder", d: "Capsular stretching, joint mobilisation, and progressive ROM restoration with electrotherapy support." },
  { icon: Dumbbell, t: "Sports Injuries", d: "Sprains, strains, ligament tears, and return-to-play conditioning for athletes of all levels." },
  { icon: HeartPulse, t: "Post-Operative Rehab", d: "Structured protocols after TKR, THR, ACL, rotator cuff, and spine surgery." },
  { icon: Bone, t: "Orthopaedic Conditions", d: "Arthritis, tendinopathies, fractures, and degenerative joint conditions." },
  { icon: Brain, t: "Neurological Rehab", d: "Stroke recovery, Parkinson's, peripheral nerve injuries, and balance training." },
  { icon: Footprints, t: "Gait & Posture", d: "Comprehensive gait analysis, orthotic guidance, and biomechanical correction." },
  { icon: Baby, t: "Paediatric & Geriatric", d: "Developmental delays, fall prevention, and mobility programs for all ages." },
];

function SpecialitiesPage() {
  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold">Specialities</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Comprehensive physiotherapy programs covering musculoskeletal, sports,
            neurological, and post-surgical rehabilitation.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ITEMS.map((i) => (
            <div key={i.t} className="p-6 rounded-2xl bg-card border hover:soft-shadow transition-all">
              <div className="size-12 rounded-xl brand-gradient grid place-items-center text-white mb-4">
                <i.icon className="size-5" />
              </div>
              <h3 className="font-semibold text-lg">{i.t}</h3>
              <p className="text-sm text-muted-foreground mt-2">{i.d}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
