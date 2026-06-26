import { useRef, useState } from "react";
import { LOGO_URL, CLINIC } from "@/lib/logo";
import type { Patient, Visit } from "@/lib/types";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Printer, Download, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface Props {
  patient: Patient;
  lastVisit?: Visit;
  onClose: () => void;
}

export function PrescriptionDialog({ patient, lastVisit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : "—";

  const [rx, setRx] = useState({
    diagnosis: patient.cc || "",
    manualTherapy: lastVisit?.tx || "Manual mobilisation, soft tissue release, joint glides",
    modalities: "IFT 15 min, Ultrasound 5 min, Moist heat 10 min",
    exercises: lastVisit?.adv || "1. Stretching: hold 30s × 3 reps\n2. Strengthening: 10 reps × 3 sets\n3. Postural correction drills × daily",
    advice: "Avoid heavy lifting. Maintain correct posture. Apply ice after exercises if sore.",
    review: lastVisit?.nxt || "",
  });

  async function exportPdf() {
    if (!ref.current) return;
    toast.loading("Generating PDF...", { id: "pdf" });
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = (canvas.height * pw) / canvas.width;
      pdf.addImage(img, "JPEG", 0, 0, pw, Math.min(ph, pdf.internal.pageSize.getHeight()));
      pdf.save(`Prescription_${patient.pid}_${Date.now()}.pdf`);
      toast.success("PDF downloaded", { id: "pdf" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF", { id: "pdf" });
    }
  }

  function printRx() { window.print(); }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto print:bg-white print:overflow-visible">
      <div className="min-h-full flex items-start justify-center p-4 print:p-0">
        <div className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl my-8 print:my-0 print:shadow-none print:rounded-none">
          {/* Toolbar — hidden in print */}
          <div className="p-4 border-b flex items-center justify-between print:hidden">
            <h2 className="font-semibold text-lg">Prescription · {patient.pid}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={printRx}><Printer className="size-4" /> Print</Button>
              <Button size="sm" className="brand-gradient text-white border-0" onClick={exportPdf}><Download className="size-4" /> Export PDF</Button>
              <Button size="sm" variant="ghost" onClick={onClose}><X className="size-4" /></Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_1.4fr] gap-0">
            {/* Editor */}
            <div className="p-5 border-r space-y-4 bg-surface print:hidden">
              <h3 className="font-semibold text-sm">Prescription Content</h3>
              <div><Label>Diagnosis</Label><Input value={rx.diagnosis} onChange={(e) => setRx({ ...rx, diagnosis: e.target.value })} /></div>
              <div><Label>Manual Therapy</Label><Textarea rows={2} value={rx.manualTherapy} onChange={(e) => setRx({ ...rx, manualTherapy: e.target.value })} /></div>
              <div><Label>Modalities</Label><Textarea rows={2} value={rx.modalities} onChange={(e) => setRx({ ...rx, modalities: e.target.value })} /></div>
              <div><Label>Exercise Protocol</Label><Textarea rows={5} value={rx.exercises} onChange={(e) => setRx({ ...rx, exercises: e.target.value })} /></div>
              <div><Label>Advice</Label><Textarea rows={3} value={rx.advice} onChange={(e) => setRx({ ...rx, advice: e.target.value })} /></div>
              <div><Label>Review On</Label><Input type="date" value={rx.review} onChange={(e) => setRx({ ...rx, review: e.target.value })} /></div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted print:p-0 print:bg-white">
              <div ref={ref} className="relative bg-white text-black p-8 mx-auto shadow-sm print:shadow-none" style={{ width: "210mm", minHeight: "297mm", boxSizing: "border-box" }}>
                {/* Watermark */}
                <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden>
                  <img src={LOGO_URL} alt="" className="w-[420px] h-[420px] object-contain" style={{ opacity: 0.07 }} />
                </div>

                {/* Letterhead */}
                <div className="relative flex items-start justify-between border-b-2 border-[#0284c7] pb-4">
                  <div className="flex items-center gap-4">
                    <img src={LOGO_URL} alt="Logo" className="w-20 h-20 object-contain rounded-full" />
                    <div>
                      <div className="text-2xl font-bold text-[#0c4a6e] leading-tight">STHAIRYA PHYSIOCARE</div>
                      <div className="text-[10px] tracking-[0.25em] text-[#0284c7] uppercase">Resilience · Firmness · Balance</div>
                      <div className="text-xs text-gray-600 mt-1">{CLINIC.address}</div>
                      <div className="text-xs text-gray-600">{CLINIC.domain} · {CLINIC.phone}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-semibold">Date</div>
                    <div>{today}</div>
                  </div>
                </div>

                {/* Patient row */}
                <div className="relative mt-5 grid grid-cols-4 gap-3 text-xs">
                  <div><div className="font-semibold text-gray-500 uppercase">Patient ID</div><div className="font-mono">{patient.pid}</div></div>
                  <div><div className="font-semibold text-gray-500 uppercase">Name</div><div className="font-medium">{patient.n}</div></div>
                  <div><div className="font-semibold text-gray-500 uppercase">Age / Sex</div><div>{age} / {patient.g}</div></div>
                  <div><div className="font-semibold text-gray-500 uppercase">Mobile</div><div>{patient.m}</div></div>
                </div>

                <div className="relative mt-6 space-y-4 text-sm">
                  <Section title="Diagnosis">{rx.diagnosis}</Section>
                  <Section title="℞ Manual Therapy">{rx.manualTherapy}</Section>
                  <Section title="Electrotherapy / Modalities">{rx.modalities}</Section>
                  <Section title="Exercise Protocol">
                    <pre className="font-sans whitespace-pre-wrap">{rx.exercises}</pre>
                  </Section>
                  <Section title="Advice">{rx.advice}</Section>
                  {rx.review && <Section title="Next Review">{new Date(rx.review).toLocaleDateString("en-IN")}</Section>}
                </div>

                <div className="relative mt-12 grid grid-cols-2 gap-4 text-xs text-gray-600">
                  <div></div>
                  <div className="text-right">
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <div className="font-semibold">Physiotherapist Signature</div>
                    <div className="text-[10px] mt-1">{CLINIC.name} · {CLINIC.domain}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
