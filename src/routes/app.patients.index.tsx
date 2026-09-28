import { createFileRoute, Link } from "@tanstack/react-router";
import { store, useStore, getDbCounts, hasMorePatientsThanLoaded } from "@/lib/store";
import type { Patient } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "@/components/IconButton";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/patients/")({
  component: Patients,
});

/** Page-size choices offered to the user; the first is the default. */
const PAGE_SIZES = [20, 50, 100] as const;

type SortKey = "recent" | "oldest" | "name-asc" | "name-desc" | "pid" | "status";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recently registered" },
  { key: "oldest", label: "Oldest first" },
  { key: "name-asc", label: "Name (A–Z)" },
  { key: "name-desc", label: "Name (Z–A)" },
  { key: "pid", label: "Patient ID" },
  { key: "status", label: "Status (active first)" },
];

/** Active patients first, then completed, then inactive. */
const STATUS_RANK: Record<string, number> = { active: 0, completed: 1, inactive: 2 };

/**
 * Comparators for each sort.
 *
 * Every one falls back to `id` when the primary keys tie. That tiebreaker is
 * not cosmetic: with an unstable order, two records with the same name (or the
 * same registration timestamp) could swap places between renders and appear on
 * two different pages, or on none at all. Comparing ids last makes the order
 * total and therefore the pagination stable.
 */
const COMPARATORS: Record<SortKey, (a: Patient, b: Patient) => number> = {
  recent: (a, b) => (b.ts || 0) - (a.ts || 0) || a.id.localeCompare(b.id),
  oldest: (a, b) => (a.ts || 0) - (b.ts || 0) || a.id.localeCompare(b.id),
  "name-asc": (a, b) =>
    (a.n || "").localeCompare(b.n || "", undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id),
  "name-desc": (a, b) =>
    (b.n || "").localeCompare(a.n || "", undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id),
  pid: (a, b) =>
    (a.pid || "").localeCompare(b.pid || "", undefined, { numeric: true }) ||
    a.id.localeCompare(b.id),
  status: (a, b) =>
    (STATUS_RANK[a.status || "active"] ?? 99) - (STATUS_RANK[b.status || "active"] ?? 99) ||
    (a.n || "").localeCompare(b.n || "", undefined, { sensitivity: "base" }) ||
    a.id.localeCompare(b.id),
};

function Patients() {
  const patients = useStore((s) => s.patients);
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const canCreate = hasRole("admin", "therapist", "reception");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(1);

  // Strict 500ms debounce: the filter (and any downstream work) never runs
  // per-keystroke; typing stays instant, matching runs after the pause.
  const [dq, setDq] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 500);
    return () => clearTimeout(t);
  }, [q]);

  // Server-side search results, merged in ADDITIVELY.
  //
  // The local filter below only sees the bounded window the snapshot loaded,
  // so once the archive grows past it, searching would silently stop finding
  // older patients. This queries the whole table as well and merges the
  // results, so search keeps working at any size. Read-only, and only runs
  // when there actually are unloaded patients — so for a clinic that fits
  // entirely in the window nothing changes and no request is made.
  const [serverHits, setServerHits] = useState<Patient[]>([]);
  useEffect(() => {
    if (!dq || !hasMorePatientsThanLoaded()) {
      setServerHits([]);
      return;
    }
    let cancelled = false;
    void import("@/lib/db.functions")
      .then(({ searchPatients }) => searchPatients({ data: { q: dq } }))
      .then((r) => {
        if (!cancelled) setServerHits(r?.patients ?? []);
      })
      .catch((err) => console.error("[patients] server search failed", err));
    return () => {
      cancelled = true;
    };
  }, [dq]);

  const filtered = useMemo(() => {
    const local = patients.filter(
      (p) =>
        !dq ||
        p.sn.includes(dq.toLowerCase()) ||
        p.pid.toLowerCase().includes(dq.toLowerCase()) ||
        p.m.includes(dq),
    );
    if (serverHits.length === 0) return local;
    // Merge by id, local first so an in-memory edit the user just made wins
    // over the server's copy of the same record.
    const seen = new Set(local.map((p) => p.id));
    return [...local, ...serverHits.filter((p) => !seen.has(p.id))];
  }, [patients, dq, serverHits]);

  // Sorting is applied to the filtered set, and pagination to the sorted set,
  // so the page boundaries always follow the order the user chose.
  const sorted = useMemo(() => [...filtered].sort(COMPARATORS[sort]), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  // Clamp rather than trust `page`: deleting records, searching, or switching
  // to a larger page size can all leave the current page beyond the end of the
  // list, which would otherwise render an empty table with no way back.
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const visible = sorted.slice(startIdx, startIdx + pageSize);

  // Return to the first page whenever the result set or its ordering changes.
  // Without this, narrowing a search while on page 7 would show nothing.
  useEffect(() => {
    setPage(1);
  }, [dq, sort, pageSize]);

  // If the page got clamped (e.g. the last record on the last page was
  // deleted), fold that back into state so the controls agree with the view.
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  function onDelete(id: string, name: string) {
    if (!isAdmin) return;
    if (
      !confirm(
        `Permanently delete patient "${name}" and all associated visits/notes? This cannot be undone.`,
      )
    )
      return;
    store.deletePatient(id);
    toast.success("Patient record deleted");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Patients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {getDbCounts().patients || patients.length} total · click to view
          </p>
        </div>
        {canCreate && (
          <Link to="/app/patients/new">
            <Button className="brand-gradient text-white border-0">
              <Plus className="size-4" /> New Patient
            </Button>
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, or mobile..."
            value={q}
            // Page reset is handled centrally by the effect on `dq`, so the
            // debounced query and the visible page can never disagree.
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <label className="sr-only" htmlFor="patient-sort">
            Sort patients
          </label>
          <select
            id="patient-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-11 px-2 rounded-md border bg-background text-sm"
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="patient-page-size">
            Patients per page
          </label>
          <select
            id="patient-page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-11 px-2 rounded-md border bg-background text-sm"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-card border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">PID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Age/Sex</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Mobile</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Chief Complaint</th>
                <th className="text-left px-4 py-3">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : "—";
                const status = p.status || "active";
                const badge =
                  status === "active"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : status === "completed"
                      ? "bg-blue-500/10 text-blue-700"
                      : "bg-muted text-muted-foreground";
                return (
                  <tr key={p.id} className="border-t hover:bg-surface">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link
                        to="/app/patients/$id"
                        params={{ id: p.id }}
                        className="text-brand hover:underline font-semibold"
                      >
                        {p.pid}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/app/patients/$id"
                        params={{ id: p.id }}
                        className="hover:underline"
                      >
                        {p.n}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {age}/{p.g}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">{p.m}</td>
                    <td className="px-4 py-3 hidden lg:table-cell truncate max-w-xs">{p.cc}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${badge}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        to="/app/patients/$id"
                        params={{ id: p.id }}
                        className="text-brand text-sm font-medium hover:underline mr-2"
                      >
                        Open
                      </Link>
                      {isAdmin && (
                        <IconButton tooltip="Delete patient" onClick={() => onDelete(p.id, p.n)}>
                          <Trash2 className="size-4 text-destructive" />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-12">
                    No patients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground order-2 sm:order-1">
            Showing {startIdx + 1}–{Math.min(startIdx + pageSize, sorted.length)} of {sorted.length}
          </p>
          {totalPages > 1 && (
            <nav
              aria-label="Patient list pages"
              className="flex items-center gap-1 order-1 sm:order-2"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                disabled={safePage === 1}
                aria-label="Previous page"
              >
                Prev
              </Button>
              {pageNumbers(safePage, totalPages).map((n, i) =>
                n === "gap" ? (
                  <span key={`gap${i}`} className="px-1 text-muted-foreground select-none">
                    …
                  </span>
                ) : (
                  <Button
                    key={n}
                    variant={n === safePage ? "default" : "outline"}
                    size="sm"
                    className={n === safePage ? "brand-gradient text-white border-0" : ""}
                    onClick={() => setPage(n)}
                    aria-label={`Page ${n}`}
                    aria-current={n === safePage ? "page" : undefined}
                  >
                    {n}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                disabled={safePage === totalPages}
                aria-label="Next page"
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Page numbers to render, collapsing long runs to an ellipsis.
 *
 * Always shows the first and last page plus a window around the current one,
 * so the control stays a fixed width whether there are 3 pages or 300.
 */
function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("gap");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("gap");
  out.push(total);
  return out;
}
