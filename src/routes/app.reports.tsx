import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  FileBarChart2,
  Download,
  FileSpreadsheet,
  FileText,
  Search as SearchIcon,
} from "lucide-react";
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

  // Results render only after the user runs a search; pagination shows 10
  // records at a time with a Load More control.
  const [searched, setSearched] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  function runSearch() {
    setSearched(true);
    setVisibleCount(10);
  }

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
      Name: p.n,
      Age: age,
      Sex: p.g,
      Mobile: p.m,
      Email: p.e || "",
      Branch: branchById(settings, p.br)?.name || "",
      Status: p.status || "active",
      "Chief Complaint": p.cc || "",
      Registered: fmtDate(p.ts),
    };
  }

  function csvEscape(s: string) {
    if (s == null) return "";
    const v = String(s);
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  }

  function downloadCsv() {
    if (!rows.length) {
      toast.error("No records to export");
      return;
    }
    const records = rows.map(rowToRecord);
    const headers = Object.keys(records[0]);
    const csv = [
      headers.join(","),
      ...records.map((r) =>
        headers.map((h) => csvEscape(String((r as Record<string, unknown>)[h] ?? ""))).join(","),
      ),
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
    if (!rows.length) {
      toast.error("No records to export");
      return;
    }
    toast.loading("Generating PDF...", { id: "rep" });
    try {
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 12;

      // Circular logo (matches the prescription preview) rendered via an
      // offscreen canvas clip; falls back to the square image if unavailable.
      const circleLogo: string | null = await (async () => {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error("logo load failed"));
            img.src = LOGO_URL;
          });
          const size = 256;
          const c = document.createElement("canvas");
          c.width = size;
          c.height = size;
          const ctx = c.getContext("2d");
          if (!ctx) return null;
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.clip();
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          return c.toDataURL("image/png");
        } catch {
          return null;
        }
      })();

      const drawChrome = (pageNum: number, totalPages: number) => {
        // Same visual language as the prescription preview page: white
        // background, large faint centred watermark, round logo, brand-blue
        // clinic name with tagline, and a solid brand rule under the header.
        try {
          pdf.saveGraphicsState?.();
          const P = pdf as unknown as {
            GState?: new (o: { opacity: number }) => unknown;
            setGState: (g: unknown) => void;
          };
          if (P.GState) P.setGState(new P.GState({ opacity: 0.06 }));
          pdf.addImage(
            circleLogo ?? LOGO_URL,
            "PNG",
            pw / 2 - 60,
            ph / 2 - 60,
            120,
            120,
            undefined,
            "FAST",
          );
          pdf.restoreGraphicsState?.();
        } catch {
          /* watermark is decorative */
        }
        try {
          pdf.addImage(circleLogo ?? LOGO_URL, "PNG", margin, 5, 16, 16, undefined, "FAST");
        } catch {
          /* logo optional */
        }
        pdf.setTextColor(12, 74, 110); // #0c4a6e
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.text("STHAIRYA PHYSIOCARE", margin + 20, 11);
        pdf.setTextColor(2, 132, 199); // #0284c7
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text(
          "R E S I L I E N C E   \u00b7   F I R M N E S S   \u00b7   B A L A N C E",
          margin + 20,
          16,
        );
        pdf.setTextColor(90);
        pdf.setFontSize(8);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pw - margin, 10, { align: "right" });
        pdf.setTextColor(0);
        pdf.setDrawColor(2, 132, 199);
        pdf.setLineWidth(0.8);
        pdf.line(margin, 23, pw - margin, 23);
        pdf.setLineWidth(0.2);
        // Sub header
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(12, 74, 110);
        pdf.text("Patient Activity Report", margin, 30);
        pdf.setTextColor(0);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(
          `Range: ${fmtDate(effective.s)} \u2013 ${fmtDate(effective.e)}   \u2022   Filter: ${source === "registration" ? "Registration date" : "Visit date"}   \u2022   ${rows.length} record(s)`,
          margin,
          35,
        );
        pdf.setDrawColor(220);
        pdf.line(margin, 38, pw - margin, 38);
        // Footer — identical note, dashed-rule feel
        pdf.setFontSize(8);
        pdf.setTextColor(120);
        pdf.setLineDashPattern?.([1, 1], 0);
        pdf.setDrawColor(200);
        pdf.line(margin, ph - 10, pw - margin, ph - 10);
        pdf.setLineDashPattern?.([], 0);
        pdf.text(
          "Note: This is a system generated document. A physical signature or stamp is not required.",
          pw / 2,
          ph - 6,
          { align: "center" },
        );
        pdf.setTextColor(0);
      };

      const headers = ["PID", "Name", "Age/Sex", "Mobile", "Branch", "Status", "Registered"];
      const colX = [
        margin,
        margin + 24,
        margin + 64,
        margin + 82,
        margin + 112,
        margin + 148,
        margin + 178,
      ];
      let y = 46;

      const startPage = () => {
        drawChrome(pdf.getNumberOfPages(), 0);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        headers.forEach((h, i) => pdf.text(h, colX[i], y));
        pdf.setFont("helvetica", "normal");
        pdf.line(margin, y + 1.5, pw - margin, y + 1.5);
        y += 6;
      };

      startPage();
      rows.forEach((p) => {
        if (y > ph - 16) {
          pdf.addPage();
          y = 46;
          startPage();
        }
        const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "—";
        const branch = branchById(settings, p.br)?.name || "";
        const cells = [
          p.pid,
          (p.n || "").slice(0, 24),
          `${age}/${p.g}`,
          p.m,
          (branch || "").slice(0, 18),
          p.status || "active",
          fmtDate(p.ts),
        ];
        cells.forEach((c, i) => pdf.text(String(c), colX[i], y));
        y += 6;
      });

      // Fix page numbers
      const total = pdf.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(255);
        pdf.setFillColor(2, 132, 199);
        pdf.rect(pw - 38, 9, 30, 6, "F");
        pdf.text(`Page ${i} of ${total}`, pw - margin, 13, { align: "right" });
        pdf.setTextColor(0);
      }

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
        <div className="size-10 rounded-xl brand-gradient grid place-items-center text-white">
          <FileBarChart2 className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Patient activity by registration or visit dates.
          </p>
        </div>
      </div>

      <div className="mt-6 p-5 rounded-2xl bg-card border space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label>Source</Label>
            <select
              className="w-full h-9 px-3 rounded-md border bg-background"
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
            >
              <option value="registration">Registration date</option>
              <option value="visit">Visit date</option>
            </select>
          </div>
          <div>
            <Label>Quick Range</Label>
            <select
              className="w-full h-9 px-3 rounded-md border bg-background"
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {range === "custom" && (
            <>
              <div>
                <Label>Start</Label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Button onClick={runSearch} className="brand-gradient text-white border-0">
            <SearchIcon className="size-4" /> Find
          </Button>
          {searched && (
            <>
              <p className="text-sm text-muted-foreground">
                {rows.length} record{rows.length === 1 ? "" : "s"} · {fmtDate(effective.s)} –{" "}
                {fmtDate(effective.e)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadCsv}>
                  <FileSpreadsheet className="size-4" /> Export Excel / CSV
                </Button>
                <Button className="brand-gradient text-white border-0" onClick={downloadPdf}>
                  <FileText className="size-4" /> Generate PDF
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {!searched && (
        <div className="mt-4 p-10 rounded-2xl bg-card border text-center text-sm text-muted-foreground">
          Choose a source and date range, then press{" "}
          <span className="font-medium text-foreground">Find</span> to list matching patients.
        </div>
      )}

      {searched && (
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
                {rows.slice(0, visibleCount).map((p) => {
                  const age = p.dob
                    ? new Date().getFullYear() - new Date(p.dob).getFullYear()
                    : "—";
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3 font-mono text-xs">{p.pid}</td>
                      <td className="px-4 py-3 font-medium">{p.n}</td>
                      <td className="px-4 py-3">
                        {age}/{p.g}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{p.m}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {branchById(settings, p.br)?.name || "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">{p.status || "active"}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">{fmtDate(p.ts)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-12">
                      No records in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > visibleCount && (
            <div className="p-3 border-t text-center">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + 10)}>
                Load More ({rows.length - visibleCount} remaining)
              </Button>
            </div>
          )}
          {rows.length === 0 && (
            <p className="p-8 text-sm text-muted-foreground text-center">
              No records in this range.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
