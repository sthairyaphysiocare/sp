import { createFileRoute, Link } from "@tanstack/react-router";
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
  const data = Route.useLoaderData();
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
