## Sthairya Physiocare — Major Refinement Pass

A large, multi-area scope. I'll execute in five grouped phases. Each phase is independently shippable and I'll batch parallel file edits inside each.

### Phase 1 — Global UI/UX foundations
- **GlobalWatermark component**: extract the fixed semi-transparent logo background from `index.tsx` into `src/components/GlobalWatermark.tsx`; mount once in `__root.tsx` so it appears on every public + portal page.
- **Top-left brand text**: update `Logo.tsx` so the "STHAIRYA / Physiocare" lockup matches the hero font weight/size/color (bold display, `text-brand-gradient` for STHAIRYA).
- **Tooltips**: wrap icon-only buttons across the app with shadcn `Tooltip`. Add a small `<IconButton tooltip="Edit">` helper in `src/components/IconButton.tsx` to standardize.
- **Date picker**: new `src/components/MonthYearDatePicker.tsx` built on shadcn `Calendar` + `Popover` with month/year dropdown selects in the caption. Replace `<input type="date">` usages in patient form, visit, booking, reports.

### Phase 2 — Public site revisions
- **Hero (`routes/index.tsx`)**: remove the right-column placeholder card. Replace with three stacked taglines (Relieve / Restore / Renew) each with a Lucide icon (Feather, Activity, Sparkles) and staggered `animate-fade-in` (delays 0/150/300ms via inline style).
- **Contact (`routes/contact.tsx`)**: change intro copy; per-branch action row with Call / WhatsApp / Email buttons aligned with each branch card; remove duplicated bottom CTA block.
- **Book (`routes/book.tsx`)**: 3-button toggle row (In App Form / WhatsApp / Email), same base bg, active variant differentiated. Remove subtitles. Show selected channel content below.
- **Auth (`routes/auth.tsx`)**: center wrapper (`min-h-screen grid place-items-center`), remove username placeholder, ensure watermark inherits from root.

### Phase 3 — Admin settings & multi-branch expansion
- **Settings (`routes/app.settings.tsx`)** rebuilt with sections:
  - Branches: add per-branch hours (mon–sun text fields, simple `hours: Record<string,string>` map). Disable delete when `branches.length===1`. On delete, reassign affected patients to remaining first branch (`store.removeBranch` already handles? – update if not).
  - Editable stats: 4 inputs stored in `settings.stats` (defaults 6+/10+/61%/20+). Home page reads them.
  - Specialities CRUD: `settings.specialities: {icon, title, desc}[]` (icon is a string key mapped to Lucide map). Home + Specialities pages read from this.
  - Clinician Profiles CRUD: `settings.cliniciansEnabled` toggle + `settings.clinicians: {name, photo, qualification, exp, speciality}[]`.
- **Sidebar (`AppLayout.tsx`)**: relocate user info + logout to below Settings link.

### Phase 4 — Patient management & workflows
- **Types/store**: add `status: "active"|"inactive"|"completed"` to Patient; split `em` into `emN`/`emP`; add `tId` therapist assignment to Patient; persist edits.
- **Patients list (`app.patients.index.tsx`)**: paginate top 10 with Load More.
- **Patient detail (`app.patients.$id.tsx`)**: status toggle, lock edits unless active, full demographic + clinical edit, visit edit dialog.
- **New patient (`app.patients.new.tsx`)**: two emergency fields, therapist dropdown with default.
- **Dashboard (`app.index.tsx`)**: "Active Rehab" counts only `status==="active"`.
- **Bookings (`app.bookings.tsx`)**: allow therapist role; add "Clear Closed" button.
- **Reports (new `app.reports.tsx`)**: date filter presets + custom range; export PDF (jsPDF table) and CSV (no xlsx dep) — labeled "Excel (CSV)". Add route to sidebar.
- **Auth (`lib/auth.tsx`)**: add `"other"` role, default admin name → "Admin".

### Phase 5 — Prescription engine rework
- **`PrescriptionDialog.tsx`** rebuilt as a 2-tab wizard (Tabs: "Content" / "Preview & Print"):
  - Content tab: full-width form, optional fields.
  - Preview tab: A4 sheet with branch letterhead (no word "Branch"), centered "Physiotherapist Signature" under signature line.
  - Fix PDF: await `html2canvas` properly, then `jsPDF`; catch + toast actual error.
  - WhatsApp: prompt with editable number prefilled from patient phone; build `wa.me` link with message; no PDF attach (text fallback as before).

### Technical notes
- All new settings fields backfilled with defaults in `store.ts` migration block to avoid breaking existing localStorage.
- No new heavy deps; reuse jsPDF/html2canvas/shadcn/lucide already installed.
- Watermark moves to root → remove duplicated fixed bg from `index.tsx`.
- Tooltips require `TooltipProvider` in `__root.tsx` if not already.

### Out of scope / deferred
- Real XLSX export (would need `xlsx` dep) — CSV is offered instead under the same "Excel" button label. I'll flag this in the closing message.
- Real photo uploads — clinician photo uses URL input + default avatar fallback (no storage backend wired).
