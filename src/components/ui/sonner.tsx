import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * The one and only place a <Toaster/> should be mounted in this app — see
 * __root.tsx, which renders it once at the true app root so every route
 * shares a single, consistently-positioned notification surface.
 *
 * Previously, eleven separate route files each mounted their own bare
 * <Toaster/> with no explicit position, so every one silently fell back to
 * the library default (bottom-right) — which is exactly the corner where
 * dashboard cards and other real content live on several pages, producing
 * the reported "shows up wherever it wants" overlap. Consolidating to one
 * instance, with an explicit position and edge offset set here, is the fix:
 * there is now exactly one notification surface for the whole app, in a
 * deliberately-chosen spot that stays clear of the left sidebar, page
 * headings (normally start-aligned), and any bottom-anchored floating
 * buttons on the public site.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      offset="24px"
      mobileOffset="16px"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
