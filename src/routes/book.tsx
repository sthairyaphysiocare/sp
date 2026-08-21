import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC, enabledBranches, whatsappDigits } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { store, useStore, takenSlotsForDate } from "@/lib/store";
import { toast } from "sonner";
import { Mail, CheckCircle2 } from "lucide-react";
import { WA_GREEN, WA_GREEN_DARK, WhatsAppIcon } from "@/components/WhatsAppIcon";
import { mailtoLink, whatsappLink } from "@/lib/contactLinks";
import {
  filterPastSlots,
  fmtDate,
  fmtTime12,
  nextWorkingDay,
  slotsForDateBranch,
  todayISO,
} from "@/lib/date";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: `Book a Visit — ${CLINIC.name}` },
      {
        name: "description",
        content: "Book your physiotherapy appointment online — WhatsApp, email, or form.",
      },
    ],
    links: [{ rel: "canonical", href: "/book" }],
  }),
  component: BookPage,
});

type Channel = "form" | "whatsapp" | "email";

function BookPage() {
  const today = todayISO();
  const settings = useStore((s) => s.settings);
  const branches = enabledBranches(settings);
  const wa = whatsappDigits(settings);
  const [channel, setChannel] = useState<Channel>("form");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    concern: "",
    prefDate: today,
    prefTime: "",
    br: branches[0]?.id || "",
  });
  const [done, setDone] = useState(false);

  const taken = useStore((s) => takenSlotsForDate(s, form.prefDate));
  const branch = branches.find((b) => b.id === form.br) || branches[0];
  // Branch working hours drive the slot grid; past hours are hidden for
  // today (a morning visitor only sees the remaining afternoon times).
  const slots = useMemo(
    () => filterPastSlots(form.prefDate, slotsForDateBranch(form.prefDate, branch)),
    [form.prefDate, branch],
  );
  const closed = slots.length === 0;

  // If the selected date has no bookable time left (closed day, or today
  // after the last slot has passed), automatically move to the branch's
  // next working day.
  useEffect(() => {
    if (!form.prefDate) return;
    if (form.prefDate < today) {
      setForm((f) => ({ ...f, prefDate: today, prefTime: "" }));
      return;
    }
    const usable = filterPastSlots(form.prefDate, slotsForDateBranch(form.prefDate, branch));
    if (usable.length === 0) {
      // Closed day, or today with all remaining slots in the past — jump to
      // the branch's next working day.
      const target = nextWorkingDay(form.prefDate, branch);
      setForm((f) => ({ ...f, prefDate: target, prefTime: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.prefDate, form.br]);
  const showBranchPicker = branches.length > 1;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error("Name and phone are required");
      return;
    }
    if (!form.prefDate || !form.prefTime) {
      toast.error("Please pick a date and time");
      return;
    }
    if (taken.includes(form.prefTime)) {
      toast.error("That slot was just booked. Please pick another.");
      return;
    }
    store.addBooking({
      name: form.name,
      phone: form.phone,
      email: form.email,
      concern: form.concern,
      preferred: `${fmtDate(form.prefDate)} ${fmtTime12(form.prefTime)}`,
      prefDate: form.prefDate,
      prefTime: form.prefTime,
      br: form.br || branches[0]?.id,
    });
    // Silent internal notification to the clinic (fire-and-forget; the
    // visitor sees nothing). Sent to the Global Email via EmailJS — browsers
    // cannot send WhatsApp messages invisibly without the WhatsApp Business
    // API, so email is the reliable silent channel.
    void import("@/lib/emailOtp").then(({ sendBookingAlert }) =>
      sendBookingAlert({
        toEmail: settings.globalEmail || CLINIC.email,
        name: form.name,
        phone: form.phone,
        email: form.email,
        concern: form.concern,
        when: `${fmtDate(form.prefDate)} ${fmtTime12(form.prefTime)}`,
        branch: branch?.name || "",
      }).catch((err) => console.error("[book] silent alert failed", err)),
    );
    toast.success("Booking received — we'll contact you shortly.");
    setDone(true);
    setForm({ ...form, name: "", phone: "", email: "", concern: "", prefTime: "" });
  }

  const channels: { id: Channel; label: string; icon: React.ReactNode }[] = [
    { id: "form", label: "In App Form", icon: <CheckCircle2 className="size-4 shrink-0" /> },
    { id: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon size={16} /> },
    { id: "email", label: "Email", icon: <Mail className="size-4 shrink-0" /> },
  ];

  return (
    <PublicLayout>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold">Book Your Visit</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Choose the channel that works best for you.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3 p-1 rounded-xl bg-surface border max-w-2xl">
          {channels.map((c) => {
            const active = channel === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setChannel(c.id)}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-semibold min-h-11 transition-all ${
                  active
                    ? "bg-accent text-brand ring-1 ring-brand/40 soft-shadow"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                }`}
              >
                {c.icon}
                {/* min-w-0 lets the label absorb the squeeze in a narrow column
                    instead of the icon, which has no intrinsic minimum. */}
                <span className="min-w-0 text-center leading-tight">{c.label}</span>
              </button>
            );
          })}
        </div>

        {channel === "whatsapp" && (
          <div
            className="relative overflow-hidden mt-8 p-8 rounded-2xl border max-w-2xl"
            style={{ backgroundColor: `${WA_GREEN}0d` }}
          >
            {/* Large, very soft echo of the channel's own icon fills the space
                that would otherwise sit empty beside the short left-aligned
                content — decorative only, clipped by the card's rounded
                corners via overflow-hidden on the parent. */}
            <WhatsAppIcon
              size={230}
              className="absolute -right-8 -bottom-10 pointer-events-none"
              style={{ color: WA_GREEN, opacity: 0.09 }}
              aria-hidden="true"
            />
            <div className="relative">
              <div
                className="size-14 rounded-2xl grid place-items-center mb-4"
                style={{ backgroundColor: `${WA_GREEN}1a`, color: WA_GREEN_DARK }}
              >
                <WhatsAppIcon size={24} />
              </div>
              <h2 className="text-xl font-semibold">Chat on WhatsApp</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Tap below to start a conversation with our front desk.
              </p>
              <a
                href={whatsappLink(wa)}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-5"
              >
                <Button className="wa-btn border-0 bg-[#25D366] text-white hover:bg-[#128C7E] hover:text-white">
                  <WhatsAppIcon size={16} /> Open WhatsApp Chat
                </Button>
              </a>
            </div>
          </div>
        )}

        {channel === "email" && (
          <div className="relative overflow-hidden mt-8 p-8 rounded-2xl border max-w-2xl bg-[#3b82f60d]">
            {/* Same treatment as the WhatsApp card above: a large, very soft
                echo of the channel's own icon fills the space that would
                otherwise sit empty beside the short left-aligned content. */}
            <Mail
              className="absolute -right-8 -bottom-10 pointer-events-none text-[#3b82f6] opacity-10"
              style={{ width: 230, height: 230 }}
              aria-hidden="true"
            />
            <div className="relative">
              <div className="size-14 rounded-2xl bg-blue-500/10 text-blue-600 grid place-items-center mb-4">
                <Mail className="size-6" />
              </div>
              <h2 className="text-xl font-semibold">Email Us</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Send your details and we'll reply with available slots.
              </p>
              <a
                href={mailtoLink(settings.globalEmail || CLINIC.email)}
                className="inline-block mt-5"
              >
                <Button className="brand-gradient text-white border-0">
                  <Mail className="size-4" /> Compose Email
                </Button>
              </a>
            </div>
          </div>
        )}

        {channel === "form" && (
          <form
            onSubmit={submit}
            className="mt-8 p-6 sm:p-8 rounded-2xl bg-[#eaf7f1] border space-y-5"
          >
            <h2 className="text-xl font-semibold">Appointment Request</h2>
            {done && (
              <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-700 text-sm flex items-center gap-2">
                <CheckCircle2 className="size-4" /> Your request was submitted. Our team will reach
                out soon.
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              {showBranchPicker && (
                <div>
                  <Label htmlFor="br">Preferred Location *</Label>
                  <select
                    id="br"
                    className="w-full h-9 px-3 rounded-md border bg-background"
                    value={form.br}
                    onChange={(e) => setForm({ ...form, br: e.target.value })}
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label htmlFor="prefDate">Preferred Date *</Label>
                <Input
                  id="prefDate"
                  type="date"
                  min={today}
                  value={form.prefDate}
                  onChange={(e) => setForm({ ...form, prefDate: e.target.value, prefTime: "" })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="prefTime">Preferred Time *</Label>
                <select
                  id="prefTime"
                  className="w-full h-9 px-3 rounded-md border bg-background"
                  value={form.prefTime}
                  onChange={(e) => setForm({ ...form, prefTime: e.target.value })}
                  required
                >
                  <option value="">{closed ? "Clinic closed" : "Select Time"}</option>
                  {slots.map((s) => (
                    <option key={s} value={s} disabled={taken.includes(s)}>
                      {fmtTime12(s)}
                      {taken.includes(s) ? " — Booked" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="concern">Concern / Symptoms</Label>
              <Textarea
                id="concern"
                rows={4}
                value={form.concern}
                onChange={(e) => setForm({ ...form, concern: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="brand-gradient text-white border-0"
              disabled={closed || !form.prefTime}
            >
              Submit Request
            </Button>
          </form>
        )}
      </section>
    </PublicLayout>
  );
}
