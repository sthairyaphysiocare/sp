import { useRef, useState } from "react";
import { LOGO_URL, branchById, whatsappDigits } from "@/lib/logo";
import type { Patient, Visit } from "@/lib/types";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Printer, Download, X, ArrowLeft, ArrowRight, Eye, Pencil, Receipt, Plus, Trash2 } from "lucide-react";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { toast } from "sonner";
import { fmtDate, fmtTime12, slotsForDate } from "@/lib/date";

interface Props {
  patient: Patient;
  lastVisit?: Visit;
  onClose: () => void;
}

type Step = "edit" | "preview";

interface ReceiptItem { id: string; desc: string; qty: number; rate: number }

const SERVICE_PRESETS = [
  "Physiotherapy Consultation",
  "Therapeutic Exercise Session",
  "Manual Therapy",
  "Electrotherapy / Ultrasound",
  "IFT / TENS Session",
  "Dry Needling",
  "Cupping Therapy",
  "Postural Correction",
  "Sports Rehabilitation",
  "Home Visit Charges",
];

export function PrescriptionDialog({ patient, lastVisit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = fmtDate(new Date());
  const todayISO = new Date().toISOString().slice(0, 10);
  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "—";

  const settings = useStore((s) => s.settings);
  const branch = branchById(settings, patient.br) ?? settings.branches[0];

  const [step, setStep] = useState<Step>("edit");
  const [rx, setRx] = useState({
    concern: "",
    diagnosis: patient.cc || "",
    manualTherapy: lastVisit?.tx || "",
    modalities: "",
    exercises: lastVisit?.adv || "",
    advice: "",
    reviewDate: lastVisit?.nxt || "",
    reviewTime: lastVisit?.nxtTm || "",
  });
  const [receiptOn, setReceiptOn] = useState(false);
  const [receipt, setReceipt] = useState({
    no: `RX-${Date.now().toString().slice(-6)}`,
    mode: "Cash",
    items: [] as ReceiptItem[],
    paid: 0,
    notes: "",
  });
  const [busy, setBusy] = useState<null | "pdf" | "wa">(null);
  const [waPrompt, setWaPrompt] = useState(false);
  const [waNumber, setWaNumber] = useState((patient.m || "").replace(/[^0-9]/g, ""));

  const reviewSlots = slotsForDate(rx.reviewDate);
  const has = (s: string) => !!(s && s.trim());

  const receiptTotal = receipt.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const receiptHasContent = receiptOn && receipt.items.some((i) => i.desc.trim() && (i.qty > 0 || i.rate > 0));

  function addReceiptItem(desc = "") {
    setReceipt((r) => ({
      ...r,
      items: [...r.items, { id: `i${Date.now()}${Math.random().toString(36).slice(2, 5)}`, desc, qty: 1, rate: 0 }],
    }));
  }
  function updateReceiptItem(id: string, patch: Partial<ReceiptItem>) {
    setReceipt((r) => ({ ...r, items: r.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  }
  function removeReceiptItem(id: string) {
    setReceipt((r) => ({ ...r, items: r.items.filter((it) => it.id !== id) }));
  }

  async function waitForImages(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); }),
      ),
    );
  }

  async function buildPdf(): Promise<{ blob: Blob; filename: string } | null> {
    // Ensure preview is mounted
    if (step !== "preview") {
      setStep("preview");
      // wait two frames for DOM mount
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    }
    const node = ref.current;
    if (!node) throw new Error("Preview not mounted");
    await waitForImages(node);
    await new Promise((r) => setTimeout(r, 80));

    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 8000,
    });
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pw) / canvas.width;
    if (imgH <= ph) {
      pdf.addImage(img, "JPEG", 0, 0, pw, imgH);
    } else {
      let y = 0;
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(img, "JPEG", 0, y, pw, imgH);
        remaining -= ph;
        y -= ph;
        if (remaining > 0) pdf.addPage();
      }
    }
    const filename = `Prescription_${patient.pid}_${Date.now()}.pdf`;
    return { blob: pdf.output("blob"), filename };
  }

  async function downloadPdf(): Promise<{ blob: Blob; filename: string } | null> {
    if (busy) return null;
    setBusy("pdf");
    toast.loading("Generating PDF...", { id: "pdf" });
    try {
      const out = await buildPdf();
      if (!out) throw new Error("preview missing");
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement("a");
      a.href = url; a.download = out.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PDF downloaded", { id: "pdf" });
      return out;
    } catch (err) {
      console.error("PDF error", err);
      toast.error("Failed to generate PDF. Please retry.", { id: "pdf" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function openWhatsAppPrompt() {
    if (step !== "preview") {
      setStep("preview");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    }
    setWaNumber((patient.m || "").replace(/[^0-9]/g, ""));
    setWaPrompt(true);
  }

  async function sendWhatsApp() {
    if (busy) return;
    let digits = waNumber.replace(/[^0-9]/g, "");
    if (digits.length < 10) { toast.error("Enter a valid mobile number."); return; }
    if (digits.length === 10) digits = `91${digits}`;
    setBusy("wa");
    toast.loading("Preparing prescription...", { id: "wa" });
    try {
      const out = await buildPdf();
      if (out) {
        const url = URL.createObjectURL(out.blob);
        const a = document.createElement("a");
        a.href = url; a.download = out.filename; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      const fallback = whatsappDigits(settings);
      const dest = digits || fallback;
      const message =
        `Hello ${patient.n}, your prescription from Sthairya Physiocare` +
        `${branch?.name ? ` (${branch.name})` : ""} is ready. Please find the details attached.`;
      window.open(`https://wa.me/${dest}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      toast.success("WhatsApp opened — attach the downloaded PDF.", { id: "wa" });
      setWaPrompt(false);
    } catch (err) {
      console.error("WA error", err);
      toast.error("Couldn't prepare WhatsApp message. Please retry.", { id: "wa" });
    } finally {
      setBusy(null);
    }
  }

  function printRx() {
    if (step !== "preview") { setStep("preview"); setTimeout(() => window.print(), 250); return; }
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto print:bg-white print:overflow-visible">
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4 print:p-0">
        <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl my-4 sm:my-8 print:my-0 print:shadow-none print:rounded-none relative">
          {/* Sticky close button — always visible */}
          <button
            onClick={onClose}
            aria-label="Close prescription"
            title="Close"
            className="print:hidden absolute -top-3 -right-3 sm:top-3 sm:right-3 z-20 size-10 rounded-full bg-destructive text-white shadow-lg grid place-items-center hover:scale-105 transition-transform border-2 border-white"
          >
            <X className="size-5" />
          </button>

          {/* Header / stepper — hidden in print */}
          <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-3 flex-wrap print:hidden pr-12">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-semibold text-base sm:text-lg truncate">Prescription · {patient.pid}</h2>
              <div className="hidden sm:flex items-center gap-1 ml-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full ${step === "edit" ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>1 · Content</span>
                <span className="text-muted-foreground">→</span>
                <span className={`px-2 py-0.5 rounded-full ${step === "preview" ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>2 · Preview</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {step === "edit" ? (
                <Button size="sm" className="brand-gradient text-white border-0" onClick={() => setStep("preview")}>
                  <Eye className="size-4" /> Preview & Print <ArrowRight className="size-4" />
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setStep("edit")}>
                    <ArrowLeft className="size-4" /> <Pencil className="size-4" /> Back to Content
                  </Button>
                  <Button size="sm" variant="outline" onClick={printRx}><Printer className="size-4" /> Print</Button>
                  <Button size="sm" variant="outline" onClick={() => downloadPdf()} disabled={!!busy}>
                    <Download className="size-4" /> {busy === "pdf" ? "Generating..." : "Download PDF"}
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={openWhatsAppPrompt} disabled={!!busy}>
                    <WhatsAppIcon size={16} /> {busy === "wa" ? "Preparing..." : "Send via WhatsApp"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Step 1 — Content form */}
          {step === "edit" && (
            <div className="p-4 sm:p-6 print:hidden">
              <p className="text-xs text-muted-foreground mb-4">All fields are optional. Empty sections won't appear in the printed prescription.</p>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="lg:col-span-2">
                  <Label>To Whomsoever It May Concern</Label>
                  <Textarea rows={3} value={rx.concern} onChange={(e) => setRx({ ...rx, concern: e.target.value })}
                            placeholder="e.g. fitness certificate, referral note, employer letter" />
                </div>
                <div><Label>Diagnosis</Label><Input value={rx.diagnosis} onChange={(e) => setRx({ ...rx, diagnosis: e.target.value })} /></div>
                <div><Label>℞ Manual Therapy</Label><Input value={rx.manualTherapy} onChange={(e) => setRx({ ...rx, manualTherapy: e.target.value })} /></div>
                <div className="lg:col-span-2"><Label>Electrotherapy / Modalities</Label><Textarea rows={2} value={rx.modalities} onChange={(e) => setRx({ ...rx, modalities: e.target.value })} /></div>
                <div className="lg:col-span-2"><Label>Exercise Protocol</Label><Textarea rows={5} value={rx.exercises} onChange={(e) => setRx({ ...rx, exercises: e.target.value })} /></div>
                <div className="lg:col-span-2"><Label>Advice</Label><Textarea rows={3} value={rx.advice} onChange={(e) => setRx({ ...rx, advice: e.target.value })} /></div>
                <div>
                  <Label>Next Review Date</Label>
                  <Input type="date" min={todayISO} value={rx.reviewDate} onChange={(e) => setRx({ ...rx, reviewDate: e.target.value, reviewTime: "" })} />
                </div>
                <div>
                  <Label>Next Review Time</Label>
                  <select className="w-full h-9 px-3 rounded-md border bg-background" value={rx.reviewTime}
                          onChange={(e) => setRx({ ...rx, reviewTime: e.target.value })} disabled={!rx.reviewDate}>
                    <option value="">— None —</option>
                    {reviewSlots.map((s) => <option key={s} value={s}>{fmtTime12(s)}</option>)}
                  </select>
                </div>
              </div>

              {/* Payment Receipt (optional) */}
              <div className="mt-6 border rounded-xl p-4 bg-surface/50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={receiptOn} onChange={(e) => setReceiptOn(e.target.checked)} className="size-4" />
                  <Receipt className="size-4 text-brand" />
                  <span className="font-semibold text-sm">Include Payment Receipt (optional)</span>
                </label>
                {receiptOn && (
                  <div className="mt-4 space-y-3">
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div><Label>Receipt No.</Label><Input value={receipt.no} onChange={(e) => setReceipt({ ...receipt, no: e.target.value })} /></div>
                      <div>
                        <Label>Payment Mode</Label>
                        <select className="w-full h-9 px-3 rounded-md border bg-background" value={receipt.mode}
                                onChange={(e) => setReceipt({ ...receipt, mode: e.target.value })}>
                          {["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Insurance"].map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div><Label>Amount Paid (₹)</Label><Input type="number" min={0} value={receipt.paid || ""} onChange={(e) => setReceipt({ ...receipt, paid: Number(e.target.value) || 0 })} /></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Services / Charges</Label>
                        <div className="flex flex-wrap gap-1">
                          {SERVICE_PRESETS.slice(0, 5).map((s) => (
                            <button key={s} type="button" onClick={() => addReceiptItem(s)}
                                    className="text-[11px] px-2 py-1 rounded-full bg-brand/10 text-brand hover:bg-brand/20">
                              + {s}
                            </button>
                          ))}
                          <button type="button" onClick={() => addReceiptItem("")}
                                  className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-accent inline-flex items-center gap-1">
                            <Plus className="size-3" /> Custom
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {receipt.items.length === 0 && <p className="text-xs text-muted-foreground">No items added yet. Use the quick buttons above.</p>}
                        {receipt.items.map((it) => (
                          <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                            <Input className="col-span-12 sm:col-span-6" placeholder="Service description"
                                   value={it.desc} onChange={(e) => updateReceiptItem(it.id, { desc: e.target.value })} />
                            <Input className="col-span-4 sm:col-span-2" type="number" min={1} placeholder="Qty"
                                   value={it.qty || ""} onChange={(e) => updateReceiptItem(it.id, { qty: Number(e.target.value) || 0 })} />
                            <Input className="col-span-5 sm:col-span-3" type="number" min={0} placeholder="Rate (₹)"
                                   value={it.rate || ""} onChange={(e) => updateReceiptItem(it.id, { rate: Number(e.target.value) || 0 })} />
                            <button type="button" onClick={() => removeReceiptItem(it.id)}
                                    title="Remove"
                                    className="col-span-3 sm:col-span-1 h-9 grid place-items-center rounded-md hover:bg-destructive/10 text-destructive">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {receipt.items.length > 0 && (
                        <div className="text-right text-sm font-semibold mt-2">Total: ₹ {receiptTotal.toLocaleString("en-IN")}</div>
                      )}
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea rows={2} value={receipt.notes} onChange={(e) => setReceipt({ ...receipt, notes: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <Button className="brand-gradient text-white border-0" onClick={() => setStep("preview")}>
                  <Eye className="size-4" /> Preview & Print <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — A4 preview */}
          {step === "preview" && (
            <div className="p-2 sm:p-4 bg-muted print:p-0 print:bg-white overflow-x-auto">
              <div
                ref={ref}
                className="relative bg-white text-black p-8 mx-auto shadow-sm print:shadow-none"
                style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}
              >
                <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden>
                  <img src={LOGO_URL} alt="" className="w-[420px] h-[420px] object-contain" style={{ opacity: 0.07 }} crossOrigin="anonymous" />
                </div>

                <div className="relative flex items-start justify-between border-b-2 border-[#0284c7] pb-4">
                  <div className="flex items-center gap-4">
                    <img src={LOGO_URL} alt="Logo" className="w-20 h-20 object-contain rounded-full" crossOrigin="anonymous" />
                    <div>
                      <div className="text-2xl font-bold text-[#0c4a6e] leading-tight">STHAIRYA PHYSIOCARE</div>
                      <div className="text-[10px] tracking-[0.25em] text-[#0284c7] uppercase">Resilience · Firmness · Balance</div>
                      {branch && (
                        <>
                          <div className="text-xs text-gray-700 mt-1 font-semibold">{branch.name}</div>
                          <div className="text-xs text-gray-600">{branch.address}</div>
                          <div className="text-xs text-gray-600">
                            Phone: {branch.phone}
                            {branch.license && <> · Reg. No: {branch.license}</>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs" style={{ marginRight: "48px" }}>
                    <div className="font-semibold">Date</div>
                    <div>{today}</div>
                  </div>
                </div>

                <div className="relative mt-5 grid grid-cols-4 gap-3 text-xs">
                  <div><div className="font-semibold text-gray-500 uppercase">Patient ID</div><div className="font-mono">{patient.pid}</div></div>
                  <div><div className="font-semibold text-gray-500 uppercase">Name</div><div className="font-medium">{patient.n}</div></div>
                  <div><div className="font-semibold text-gray-500 uppercase">Age / Sex</div><div>{age} / {patient.g}</div></div>
                  <div><div className="font-semibold text-gray-500 uppercase">Mobile</div><div>{patient.m}</div></div>
                </div>

                <div className="relative mt-6 space-y-4 text-sm">
                  {has(rx.concern) && (
                    <Section title="To Whomsoever It May Concern">
                      <pre className="font-sans whitespace-pre-wrap">{rx.concern}</pre>
                    </Section>
                  )}
                  {has(rx.diagnosis) && <Section title="Diagnosis">{rx.diagnosis}</Section>}
                  {has(rx.manualTherapy) && <Section title="℞ Manual Therapy">{rx.manualTherapy}</Section>}
                  {has(rx.modalities) && <Section title="Electrotherapy / Modalities">{rx.modalities}</Section>}
                  {has(rx.exercises) && (
                    <Section title="Exercise Protocol">
                      <pre className="font-sans whitespace-pre-wrap">{rx.exercises}</pre>
                    </Section>
                  )}
                  {has(rx.advice) && <Section title="Advice">{rx.advice}</Section>}
                  {has(rx.reviewDate) && (
                    <Section title="Next Review">
                      {fmtDate(rx.reviewDate)}{rx.reviewTime ? ` · ${fmtTime12(rx.reviewTime)}` : ""}
                    </Section>
                  )}

                  {receiptHasContent && (
                    <div className="mt-2 border border-[#0284c7]/40 rounded-md overflow-hidden">
                      <div className="bg-[#0284c7]/10 px-3 py-2 flex items-center justify-between">
                        <div className="text-[11px] font-bold text-[#0c4a6e] uppercase tracking-wider">Payment Receipt</div>
                        <div className="text-[11px] text-gray-700">
                          <span className="font-semibold">Receipt #</span> {receipt.no} &nbsp;·&nbsp;
                          <span className="font-semibold">Mode:</span> {receipt.mode}
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-1.5">Service</th>
                            <th className="text-right px-3 py-1.5 w-16">Qty</th>
                            <th className="text-right px-3 py-1.5 w-24">Rate (₹)</th>
                            <th className="text-right px-3 py-1.5 w-28">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receipt.items.filter((i) => i.desc.trim()).map((it) => (
                            <tr key={it.id} className="border-t">
                              <td className="px-3 py-1.5">{it.desc}</td>
                              <td className="px-3 py-1.5 text-right">{it.qty}</td>
                              <td className="px-3 py-1.5 text-right">{it.rate.toLocaleString("en-IN")}</td>
                              <td className="px-3 py-1.5 text-right">{(it.qty * it.rate).toLocaleString("en-IN")}</td>
                            </tr>
                          ))}
                          <tr className="border-t bg-gray-50 font-semibold">
                            <td className="px-3 py-1.5" colSpan={3}>Total</td>
                            <td className="px-3 py-1.5 text-right">₹ {receiptTotal.toLocaleString("en-IN")}</td>
                          </tr>
                          {receipt.paid > 0 && (
                            <tr className="border-t">
                              <td className="px-3 py-1.5" colSpan={3}>Amount Paid</td>
                              <td className="px-3 py-1.5 text-right">₹ {receipt.paid.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          {receipt.paid > 0 && receiptTotal - receipt.paid !== 0 && (
                            <tr className="border-t">
                              <td className="px-3 py-1.5" colSpan={3}>{receiptTotal - receipt.paid > 0 ? "Balance Due" : "Change"}</td>
                              <td className="px-3 py-1.5 text-right">₹ {Math.abs(receiptTotal - receipt.paid).toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      {receipt.notes && (
                        <div className="px-3 py-2 text-[11px] text-gray-700 border-t bg-gray-50">{receipt.notes}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer note instead of signature */}
                <div className="relative mt-16 pt-4 border-t border-dashed border-gray-300 text-center text-[11px] text-gray-600 italic">
                  Note: This is a system generated document. A physical signature or stamp is not required.
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp number prompt */}
          {waPrompt && (
            <div className="fixed inset-0 z-[60] bg-black/60 grid place-items-center p-4 print:hidden">
              <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-5">
                <h3 className="font-semibold text-lg">Send Prescription via WhatsApp</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Confirm the recipient's WhatsApp number. The PDF will be downloaded for you to attach in the chat.
                </p>
                <div className="mt-4">
                  <Label>WhatsApp Number</Label>
                  <Input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="9900315254 or 919900315254" />
                  <p className="text-[11px] text-muted-foreground mt-1">If you enter 10 digits, +91 will be added automatically.</p>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setWaPrompt(false)}>Cancel</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={sendWhatsApp} disabled={!!busy}>
                    <WhatsAppIcon size={16} /> {busy === "wa" ? "Preparing..." : "Open WhatsApp"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-[#0c4a6e] uppercase tracking-wider mb-1">{title}</div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}
