import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard — Sthairya" }, { name: "robots", content: "noindex" }] }),
  component: AppLayout,
});
