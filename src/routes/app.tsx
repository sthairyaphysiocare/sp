import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Dashboard — Sthairya" }, { name: "robots", content: "noindex" }] }),
  component: AppLayout,
});
