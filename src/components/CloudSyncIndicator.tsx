import { useEffect, useState } from "react";
import { subscribeSyncStatus, type SyncStatus } from "@/lib/store";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";

export function CloudSyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  useEffect(() => subscribeSyncStatus(setStatus), []);
  if (status === "idle") return null;
  const meta = {
    syncing: { icon: RefreshCw, label: "Syncing…", cls: "bg-brand/10 text-brand animate-pulse" },
    error: { icon: TriangleAlert, label: "Cloud sync failed", cls: "bg-destructive/10 text-destructive" },
    offline: { icon: CloudOff, label: "Offline — using local data", cls: "bg-amber-500/10 text-amber-600" },
  }[status] ?? { icon: Cloud, label: "", cls: "" };
  const Icon = meta.icon;
  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur ${meta.cls}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === "syncing" ? "animate-spin" : ""}`} />
      <span>{meta.label}</span>
    </div>
  );
}
