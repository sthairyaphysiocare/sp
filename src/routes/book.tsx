import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/PublicLayout";
import { CLINIC } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { store } from "@/lib/store";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { MessageCircle, Mail, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: `Book a Visit — ${CLINIC.name}` },
      { name: "description", content: "Book your physiotherapy appointment online — WhatsApp, email, or form." },
      { property: "og:title", content: `Book a Visit — ${CLINIC.name}` },
      { property: "og:url", content: "/book" },
    ],
    links: [{ rel: "canonical", href: "/book" }],
  }),
  component: BookPage,
});

function BookPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", concern: "", preferred: "" });
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error("Name and phone are required");
      return;
    }
    store.addBooking(form);
    toast.success("Booking received — we'll contact you shortly.");
    setDone(true);
    setForm({ name: "", phone: "", email: "", concern: "", preferred: "" });
  }

  return (
    <PublicLayout>
      <Toaster />
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h1 className="text-4xl sm:text-5xl font-bold">Book Your Visit</h1>
        <p className="mt-4 text-lg text-muted-foreground">Choose the channel that works best for you.</p>

        <div className="mt-10 grid lg:grid-cols-3 gap-4">
          <a href={`https://wa.me/${CLINIC.whatsapp}?text=${encodeURIComponent("Hi, I'd like to book a physiotherapy session.")}`}
             target="_blank" rel="noreferrer"
             className="p-6 rounded-2xl bg-card border hover:soft-shadow transition-all">
            <div className="size-12 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center mb-4"><MessageCircle className="size-5" /></div>
            <h3 className="font-semibold">WhatsApp</h3>
            <p className="text-sm text-muted-foreground mt-1">Fastest response — chat directly.</p>
            <p className="text-xs text-brand mt-2">{CLINIC.phone}</p>
          </a>
          <a href={`mailto:${CLINIC.email}?subject=${encodeURIComponent("Appointment Request")}`}
             className="p-6 rounded-2xl bg-card border hover:soft-shadow transition-all">
            <div className="size-12 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center mb-4"><Mail className="size-5" /></div>
            <h3 className="font-semibold">Email</h3>
            <p className="text-sm text-muted-foreground mt-1">Send us your details.</p>
            <p className="text-xs text-brand mt-2 break-all">{CLINIC.email}</p>
          </a>
          <div className="p-6 rounded-2xl brand-gradient text-white">
            <div className="size-12 rounded-xl bg-white/20 grid place-items-center mb-4"><CheckCircle2 className="size-5" /></div>
            <h3 className="font-semibold">In-App Form</h3>
            <p className="text-sm text-white/90 mt-1">Submit below — queued for our reception desk.</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-10 p-6 sm:p-8 rounded-2xl bg-card border space-y-5">
          <h2 className="text-xl font-semibold">Appointment Request</h2>
          {done && (
            <div className="p-4 rounded-lg bg-emerald-500/10 text-emerald-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Your request was submitted. Our team will reach out soon.
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="pref">Preferred Date / Time</Label>
              <Input id="pref" placeholder="e.g. Tomorrow 5 PM" value={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="concern">Concern / Symptoms</Label>
            <Textarea id="concern" rows={4} value={form.concern} onChange={(e) => setForm({ ...form, concern: e.target.value })} />
          </div>
          <Button type="submit" size="lg" className="brand-gradient text-white border-0">Submit Request</Button>
        </form>
      </section>
    </PublicLayout>
  );
}
