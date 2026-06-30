import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { FileBarChart2, Download, FileSpreadsheet, FileText } from "lucide-react";
import { fmtDate } from "@/lib/date";
import { LOGO_URL, branchById } from "@/lib/logo";
import type { Patient } from "@/lib/types";

export const Route = createFileRoute("/app/reports")({
  component: Reports,
});

type Range = "week" | "month" | "3months" | "custom";
type Source = "registration" | "visit";

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function Reports() {
  const patients = useStore((s) => s.patients);
  const visits = useStore((s) => s.visits);
  const settings = useStore((s) => s.settings);
  const [source, setSource] = useState<Source>("registration");
  const [range, setRange] = useState<Range>("month");
  const [start, setStart] = useState(daysAgo(30));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));

  const effective = useMemo(() => {
    if (range === "custom") return { s: start, e: end };
    const e = new Date().toISOString().slice(0, 10);
    if (range === "week") return { s: daysAgo(7), e };
    if (range === "month") return { s: daysAgo(30), e };
    return { s: daysAgo(90), e };
  }, [range, start, end]);

  const rows = useMemo(() => {
    const sMs = new Date(effective.s + "T00:00:00").getTime();
    const eMs = new Date(effective.e + "T23:59:59").getTime();
    let ids: string[];
    if (source === "registration") {
      ids = patients.filter((p) => p.ts >= sMs && p.ts <= eMs).map((p) => p.id);
    } else {
      const set = new Set(
        visits
          .filter((v) => {
            const t = new Date(v.dt + "T00:00:00").getTime();
            return t >= sMs && t <= eMs;
          })
          .map((v) => v.patientId),
      );
      ids = Array.from(set);
    }
    return ids
      .map((id) => patients.find((p) => p.id === id))
      .filter((p): p is Patient => !!p)
      .sort((a, b) => b.ts - a.ts);
  }, [source, effective, patients, visits]);

  function rowToRecord(p: Patient) {
    const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "";
    return {
      "Patient ID": p.pid,
      "Name": p.n,
      "Age": age,
      "Sex": p.g,
      "Mobile": p.m,
      "Email": p.e || "",
      "Branch": branchById(settings, p.br)?.name || "",
      "Status": p.status || "active",
      "Chief Complaint": p.cc || "",
      "Registered": fmtDate(p.ts),
    };
  }

  function csvEscape(s: string) {
    if (s == null) return "";
    const v = String(s);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }

  function downloadCsv() {
    if (!rows.length) { toast.error("No records to export"); return; }
    const records = rows.map(rowToRecord);
    const headers = Object.keys(records[0]);
    const csv = [
      headers.join(","),
      ...records.map((r) => headers.map((h) => csvEscape((r as any)[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sthairya_Report_${effective.s}_to_${effective.e}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  async function downloadPdf() {
    if (!rows.length) { toast.error("No records to export"); return; }
    toast.loading("Generating PDF...", { id: "rep" });
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      // watermark
      try {
        pdf.addImage(LOGO_URL, "JPEG", pw / 2 - 60, ph / 2 - 60, 120, 120, undefined, "FAST");
      } catch {}
      pdf.setFontSize(16);
      pdf.text("Sthairya Physiocare — Patient Report", 10, 14);
      pdf.setFontSize(9);
      pdf.text(`Range: ${fmtDate(effective.s)} – ${fmtDate(effective.e)}  ·  Filter: ${source === "registration" ? "Registration date" : "Visit date"}  ·  ${rows.length} records`, 10, 20);

      const headers = ["PID", "Name", "Age/Sex", "Mobile", "Branch", "Status", "Registered"];
      const colX = [10, 38, 75, 92, 122, 152, 178];
      let y = 30;
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      headers.forEach((h, i) => pdf.text(h, colX[i], y));
      pdf.setFont("helvetica", "normal");
      y += 5;
      pdf.line(10, y - 2, pw - 10, y - 2);
      rows.forEach((p) => {
        if (y > ph - 12) {
          pdf.addPage();
          y = 14;
        }
        const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "—";
        const branch = branchById(settings, p.br)?.name || "";
        const cells = [
          p.pid, (p.n || "").slice(0, 22), `${age}/${p.g}`,
          p.m, branch, (p.status || "active"), fmtDate(p.ts),
        ];
        cells.forEach((c, i) => pdf.text(String(c), colX[i], y));
        y += 6;
      });
      pdf.save(`Sthairya_Report_${effective.s}_to_${effective.e}.pdf`);
      toast.success("PDF downloaded", { id: "rep" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF", { id: "rep" });
    }
  }

  return (
    <div>
      <Toaster />
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl brand-gradient grid place-items-center text-white"><FileBarChart2 className="size-5" /></div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Patient activity by registration or visit dates.</p>
        </div>
      </div>

      <div className="mt-6 p-5 rounded-2xl bg-card border space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>Source</Label>
            <select className="w-full h-9 px-3 rounded-md border bg-background" value={source} onChange={(e) => setSource(e.target.value as Source)}>
              <option value="registration">Registration date</option>
              <option value="visit">Visit date</option>
            </select>
          </div>
          <div>
            <Label>Quick Range</Label>
            <select className="w-full h-9 px-3 rounded-md border bg-background" value={range} onChange={(e) => setRange(e.target.value as Range)}>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {range === "custom" && (
            <>
              <div><Label>Start</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><Label>End</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <p className="text-sm text-muted-foreground">
            {rows.length} record{rows.length === 1 ? "" : "s"} · {fmtDate(effective.s)} – {fmtDate(effective.e)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadCsv}><FileSpreadsheet className="size-4" /> CSV / Excel</Button>
            <Button className="brand-gradient text-white border-0" onClick={downloadPdf}>
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">PID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Age/Sex</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Mobile</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Branch</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "—";
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3 font-mono text-xs">{p.pid}</td>
                    <td className="px-4 py-3 font-medium">{p.n}</td>
                    <td className="px-4 py-3">{age}/{p.g}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{p.m}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{branchById(settings, p.br)?.name || "—"}</td>
                    <td className="px-4 py-3 capitalize">{p.status || "active"}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">{fmtDate(p.ts)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-12">No records in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
