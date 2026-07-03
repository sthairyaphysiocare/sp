import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { store, useStore, takenSlotsForDate } from "@/lib/store";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { fmtDate, fmtTime12, slotsForDate, fmtDateTime, todayISO } from "@/lib/date";
import { CLINIC } from "@/lib/logo";
import type { Booking } from "@/lib/types";
import { Check, Clock, MessageCircle, Mail, Archive, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/bookings")({
  component: Bookings,
});

const STATUSES = ["pending", "contacted", "scheduled", "closed"] as const;

function Bookings() {
  const bookings = useStore((s) => [...s.bookings].sort((a, b) => b.ts - a.ts));
  const [proposeFor, setProposeFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  /**
   * Convert a scheduled booking into a full patient record:
   * name -> patient name, phone -> mobile, email -> email,
   * concern -> chief complaint, preferred date/time -> next scheduled visit,
   * preferred location -> branch (default branch when none chosen).
   * A visit shell carries the scheduled slot so it appears on the
   * Today's/Upcoming dashboards; the booking is archived to avoid
   * double-counting.
   */
  function convertToPatient(b: Booking) {
    const dup = store
      .get()
      .patients.find((p) => p.m.replace(/\D/g, "") === b.phone.replace(/\D/g, "") && b.phone);
    if (dup) {
      toast.error(`A patient with this mobile already exists (${dup.pid})`);
      return;
    }
    const branchId = b.br || store.get().settings.branches[0]?.id;
    const patient = store.addPatient({
      n: b.name,
      dob: "",
      g: "O",
      m: b.phone,
      am: "",
      e: b.email || "",
      oc: "",
      em: "",
      emN: "",
      emP: "",
      bg: "",
      h: 0,
      w: 0,
      cc: b.concern || "",
      pi: "",
      sx: "",
      med: "",
      al: "",
      cm: [],
      lf: "",
      fh: "",
      br: branchId,
      status: "active",
    });
    if (b.prefDate) {
      store.addVisit({
        patientId: patient.id,
        dt: todayISO(),
        tId: user?.id || "",
        tN: user?.name || "",
        pS: 0,
        sym: b.concern || "",
        rom: "",
        str: "",
        tx: "Converted from public booking — first session scheduled.",
        adv: "",
        fi: 0,
        nxt: b.prefDate,
        nxtTm: b.prefTime || undefined,
        dur: 30,
      });
    }
    store.updateBooking(b.id, { status: "closed" });
    toast.success(`${b.name} added to Patients (${patient.pid})`);
    navigate({ to: "/app/patients/$id", params: { id: patient.id } });
  }

  function approve(id: string) {
    const b = bookings.find((x) => x.id === id);
    if (!b) return;
    if (!b.prefDate || !b.prefTime) {
      toast.error("This request has no date/time. Use 'Propose New Time'.");
      return;
    }
    store.updateBooking(id, { status: "scheduled" });
    sendNotifications(b, b.prefDate, b.prefTime, "approved");
  }

  return (
    <div>
      <Toaster />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Booking Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {bookings.length} total requests · Approve or propose a new slot.
          </p>
        </div>
        {bookings.some((b) => b.status === "closed") && (
          <Button
            variant="outline"
            onClick={() => {
              if (!confirm("Archive all closed bookings? They will be removed from the queue."))
                return;
              store.clearClosedBookings();
              toast.success("Closed bookings cleared");
            }}
          >
            <Archive className="size-4" /> Clear Closed
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {bookings.length === 0 && (
          <div className="p-12 rounded-2xl bg-card border text-center text-muted-foreground">
            No bookings yet.
          </div>
        )}
        {bookings.map((b) => (
          <div key={b.id} className="p-5 rounded-2xl bg-card border">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{b.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      b.status === "pending"
                        ? "bg-orange-500/10 text-orange-700"
                        : b.status === "scheduled"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {b.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Received {fmtDateTime(b.ts)}
                  </span>
                </div>
                <div className="text-sm mt-1">
                  📞 {b.phone}
                  {b.email && ` · ✉ ${b.email}`}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Preferred:{" "}
                  {b.prefDate
                    ? `${fmtDate(b.prefDate)}${b.prefTime ? ` · ${fmtTime12(b.prefTime)}` : ""}`
                    : b.preferred || "—"}
                </div>
                {b.concern && (
                  <div className="text-sm mt-2 italic text-foreground/80">"{b.concern}"</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-start">
                {b.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => approve(b.id)}
                      className="brand-gradient text-white border-0"
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProposeFor(proposeFor === b.id ? null : b.id)}
                    >
                      <Clock className="size-4" /> Propose New Time
                    </Button>
                  </>
                )}
                {b.status === "scheduled" && (
                  <Button
                    size="sm"
                    onClick={() => convertToPatient(b)}
                    className="brand-gradient text-white border-0"
                  >
                    <UserPlus className="size-4" /> Add as Patient
                  </Button>
                )}
                <select
                  value={b.status}
                  onChange={(e) =>
                    store.updateBooking(b.id, { status: e.target.value as Booking["status"] })
                  }
                  className="h-9 px-2 rounded-md border bg-background text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {proposeFor === b.id && (
              <ProposeForm
                initialDate={b.prefDate ?? todayISO()}
                onCancel={() => setProposeFor(null)}
                onSubmit={(date, time) => {
                  store.updateBooking(b.id, {
                    status: "scheduled",
                    prefDate: date,
                    prefTime: time,
                  });
                  sendNotifications(b, date, time, "proposed");
                  setProposeFor(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposeForm({
  initialDate,
  onSubmit,
  onCancel,
}: {
  initialDate: string;
  onSubmit: (date: string, time: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("");
  const taken = useStore((s) => takenSlotsForDate(s, date));
  const slots = slotsForDate(date);

  return (
    <div className="mt-4 p-4 rounded-xl bg-surface border">
      <div className="grid sm:grid-cols-3 gap-3 items-end">
        <div>
          <Label>New Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
            }}
          />
          <div className="text-xs text-muted-foreground mt-1">{fmtDate(date)}</div>
        </div>
        <div>
          <Label>New Time</Label>
          <select
            className="w-full h-9 px-3 rounded-md border bg-background"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          >
            <option value="">Select slot</option>
            {slots.map((s) => (
              <option key={s} value={s} disabled={taken.includes(s)}>
                {fmtTime12(s)}
                {taken.includes(s) ? " (booked)" : ""}
              </option>
            ))}
          </select>
          {slots.length === 0 && (
            <div className="text-xs text-destructive mt-1">Clinic closed on this date.</div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            className="brand-gradient text-white border-0"
            disabled={!time}
            onClick={() => time && onSubmit(date, time)}
          >
            Send Proposal
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function sendNotifications(
  b: { name: string; phone: string; email: string },
  date: string,
  time: string,
  kind: "approved" | "proposed",
) {
  const when = `${fmtDate(date)} at ${fmtTime12(time)}`;
  const body =
    kind === "approved"
      ? `Hi ${b.name}, your appointment at ${CLINIC.name} is confirmed for ${when}. See you then!`
      : `Hi ${b.name}, ${CLINIC.name} proposes a new appointment slot: ${when}. Reply to confirm.`;

  // Placeholder triggers — would integrate with WhatsApp Business API & SMTP server in production
  toast.success(`${kind === "approved" ? "Approved" : "Proposed"} · WhatsApp + Email queued`, {
    description: body,
    icon: <MessageCircle className="size-4" />,
    action: b.email
      ? {
          label: "Open Email",
          onClick: () =>
            window.open(`mailto:${b.email}?subject=Appointment&body=${encodeURIComponent(body)}`),
        }
      : undefined,
  });
  // Open WhatsApp deep link in a new tab so staff can dispatch immediately
  if (b.phone) {
    const wa = b.phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(body)}`, "_blank", "noopener");
  }
  // Email icon used only to keep import referenced for future inline buttons
  void Mail;
}
