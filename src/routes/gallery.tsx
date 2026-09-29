import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC } from "@/lib/logo";
import { fetchGallery } from "@/lib/db.functions";
import { GalleryWall, type GalleryMedia } from "@/components/GalleryWall";

/**
 * The public gallery.
 *
 * Loaded on the server so the media is in the HTML on first paint — a wall of
 * images that only appears after a client round trip reads as a broken page
 * for the moment it is empty.
 *
 * fetchGallery never throws: an unreachable database returns "disabled" and
 * the page says so, rather than taking the site down with it.
 */
export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: `Gallery - ${CLINIC.name}` },
      {
        name: "description",
        content: `A closer look at your path to wellness - photographs and clips from inside ${CLINIC.name}.`,
      },
    ],
    links: [{ rel: "canonical", href: "/gallery" }],
  }),
  loader: async () => await fetchGallery(),
  component: GalleryPage,
});

function GalleryPage() {
  const initial = Route.useLoaderData();
  const [data, setData] = useState(initial);

  // Re-read the gallery on arrival, every time.
  //
  // The server-rendered HTML carries whatever the gallery held at the moment
  // that HTML was produced. Any cache between here and the database — the
  // edge, the browser's own back/forward store — can therefore serve a page
  // that predates a newly added photo, which is exactly how a photo ends up
  // visible on the device that uploaded it and nowhere else. The SSR payload
  // stays responsible for first paint and for search engines; this reconciles
  // it with what is actually stored.
  //
  // Failure is deliberately silent: the rendered page is already a valid view,
  // so a refresh that cannot complete should leave it alone rather than
  // replace it with an error.
  useEffect(() => {
    let cancelled = false;
    void import("@/lib/db.functions")
      .then(({ fetchGallery: refetch }) => refetch())
      .then((fresh) => {
        if (!cancelled && fresh) setData(fresh);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const items = (data?.items ?? []) as GalleryMedia[];
  const enabled = data?.enabled === true;

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-bold">Gallery</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            A Closer Look at Your Path to Wellness
          </p>
        </div>

        {!enabled ? (
          <EmptyNote
            title="The gallery isn't available right now"
            body="It may be switched off while we update it. Please check back soon."
          />
        ) : items.length === 0 ? (
          <EmptyNote title="Nothing here yet" />
        ) : (
          <div className="mt-12">
            <GalleryWall items={items} />
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

function EmptyNote({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mt-12 rounded-2xl border bg-surface px-6 py-14 text-center soft-shadow">
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{body}</p>}
      <Link
        to="/"
        className="mt-6 inline-block text-sm font-medium text-brand hover:underline underline-offset-4"
      >
        Back to home
      </Link>
    </div>
  );
}
