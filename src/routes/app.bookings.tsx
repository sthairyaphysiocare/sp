import { createFileRoute } from "@tanstack/react-router";
import { store, useStore } from "@/lib/store";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/app/bookings")({
  component: Bookings,
});

const STATUSES = ["pending", "contacted", "scheduled", "closed"] as const;

function Bookings() {
  const bookings = useStore((s) => [...s.bookings].sort((a, b) => b.ts - a.ts));

  return (
    <div>
      <Toaster />
      <h1 className="text-2xl sm:text-3xl font-bold">Booking Queue</h1>
      <p className="text-sm text-muted-foreground mt-1">{bookings.length} total requests</p>

      <div className="mt-6 space-y-3">
        {bookings.length === 0 && (
          <div className="p-12 rounded-2xl bg-card border text-center text-muted-foreground">
            No bookings yet. Submissions from the public website appear here.
          </div>
        )}
        {bookings.map((b) => (
          <div key={b.id} className="p-5 rounded-2xl bg-card border">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(b.ts).toLocaleString()}</span>
                </div>
                <div className="text-sm mt-1">📞 {b.phone}{b.email && ` · ✉ ${b.email}`}</div>
                {b.preferred && <div className="text-sm text-muted-foreground mt-1">Preferred: {b.preferred}</div>}
                {b.concern && <div className="text-sm mt-2 italic text-foreground/80">"{b.concern}"</div>}
              </div>
              <select
                value={b.status}
                onChange={(e) => store.updateBooking(b.id, { status: e.target.value as any })}
                className="h-9 px-2 rounded-md border bg-background text-sm self-start"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
