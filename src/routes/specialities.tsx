import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC } from "@/lib/logo";
import { useStore } from "@/lib/store";
import { getIcon } from "@/lib/icons";

export const Route = createFileRoute("/specialities")({
  head: () => ({
    meta: [
      { title: `Specialities — ${CLINIC.name}` },
      {
        name: "description",
        content:
          "Treatments offered: back pain, frozen shoulder, sports injuries, post-op rehab, neurological care.",
      },
    ],
    links: [{ rel: "canonical", href: "/specialities" }],
  }),
  component: SpecialitiesPage,
});

function SpecialitiesPage() {
  const specs = useStore((s) => s.settings.specialities);

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold">Specialities</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Comprehensive physiotherapy programs covering musculoskeletal, sports, neurological, and
            post-surgical rehabilitation.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(() => {
            // Same five tints, same cycling order, as the homepage's
            // specialities preview — so a given speciality always reads the
            // same colour on both pages.
            const palette = [
              { bg: "#1357882e", border: "#13578861", fg: "#135788" },
              { bg: "#1188b32e", border: "#1188b361", fg: "#1188B3" },
              { bg: "#3e91662e", border: "#3e916661", fg: "#3E9166" },
              { bg: "#1266952e", border: "#12669561", fg: "#126695" },
              { bg: "#288c8c2e", border: "#288c8c61", fg: "#288c8c" },
            ];
            return specs.map((i, idx) => {
              const Icon = getIcon(i.icon);
              const c = palette[idx % palette.length];
              return (
                <div
                  key={i.id}
                  className="p-6 rounded-2xl border soft-shadow transition-all"
                  style={{ backgroundColor: c.bg, borderColor: c.border }}
                >
                  <div
                    className="size-12 rounded-xl grid place-items-center text-white mb-4"
                    style={{ backgroundColor: c.fg }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-semibold text-lg">{i.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{i.desc}</p>
                </div>
              );
            });
          })()}
        </div>
      </section>
    </PublicLayout>
  );
}
