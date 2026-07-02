import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC, enabledBranches, whatsappDigits } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";
import { store, useStore, takenSlotsForDate } from "@/lib/store";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Mail, CheckCircle2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { fmtDate, fmtTime12, slotsForDate } from "@/lib/date";

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
  const today = new Date().toISOString().slice(0, 10);
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
  const slots = useMemo(() => slotsForDate(form.prefDate), [form.prefDate]);
  const closed = slots.length === 0;
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
    toast.success("Booking received — we'll contact you shortly.");
    setDone(true);
    setForm({ ...form, name: "", phone: "", email: "", concern: "", prefTime: "" });
  }

  const channels: { id: Channel; label: string; icon: React.ReactNode }[] = [
    { id: "form", label: "In App Form", icon: <CheckCircle2 className="size-4" /> },
    { id: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon size={16} /> },
    { id: "email", label: "Email", icon: <Mail className="size-4" /> },
  ];

  return (
    <PublicLayout>
      <Toaster />
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
                <span className="hidden xs:inline sm:inline">{c.label}</span>
                <span className="sm:hidden inline">{c.label}</span>
              </button>
            );
          })}
        </div>

        {channel === "whatsapp" && (
          <div className="mt-8 p-8 rounded-2xl bg-card border">
            <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center mb-4">
              <WhatsAppIcon size={24} />
            </div>
            <h2 className="text-xl font-semibold">Chat on WhatsApp</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Tap below to start a conversation with our front desk.
            </p>
            <a
              href={`https://wa.me/${wa}?text=${encodeURIComponent("Hi, I'd like to book a physiotherapy session.")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-5"
            >
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                <WhatsAppIcon size={16} /> Open WhatsApp Chat
              </Button>
            </a>
          </div>
        )}

        {channel === "email" && (
          <div className="mt-8 p-8 rounded-2xl bg-card border">
            <div className="size-14 rounded-2xl bg-blue-500/10 text-blue-600 grid place-items-center mb-4">
              <Mail className="size-6" />
            </div>
            <h2 className="text-xl font-semibold">Email Us</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Send your details and we'll reply with available slots.
            </p>
            <a
              href={`mailto:${settings.globalEmail || CLINIC.email}?subject=${encodeURIComponent("Appointment Request")}`}
              className="inline-block mt-5"
            >
              <Button className="brand-gradient text-white border-0">
                <Mail className="size-4" /> Compose Email
              </Button>
            </a>
          </div>
        )}

        {channel === "form" && (
          <form onSubmit={submit} className="mt-8 p-6 sm:p-8 rounded-2xl bg-card border space-y-5">
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
                <div className="text-[11px] text-muted-foreground mt-1">
                  Mon–Fri 9 AM–1 PM &amp; 4 PM–8 PM · Sat 9 AM–1 PM · Sun by appointment
                </div>
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
