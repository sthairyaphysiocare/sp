# Sthairya Physiocare — Major Upgrade Plan

This is a very large batch of changes. I'll execute it in ordered phases so nothing regresses. Please confirm before I start — especially the Turso migration, which has significant implications (see "Important decisions to confirm" at the end).

## Phase 0 — Turso Cloud DB Migration (foundational)
- Install `@libsql/client`.
- Add `VITE_TURSO_DB_URL` and `VITE_TURSO_AUTH_TOKEN` as secrets (env vars). Never hardcoded.
- New `src/lib/turso.ts` — creates client via `createClient` from `@libsql/client/web`, reads env only.
- New `src/lib/db/schema.ts` — idempotent `CREATE TABLE IF NOT EXISTS` for: users, patients, visits, clinical_notes, bookings, branches, settings, specialities, clinicians, otp_attempts, locked_accounts. FK constraints on, unique keys on PID / username / email. Text/number/date/bool only — no blobs.
- Passwords hashed with PBKDF2-SHA256 (Web Crypto, salted, 100k iters). Migration re-hashes existing plaintext once, then discards.
- Rewrite `src/lib/store.ts` as an async data layer backed by Turso. Public API becomes async (`await store.addPatient(...)`). All consumers updated to `await` / React Query.
- Add global `<QueryClientProvider>` and skeleton/spinner states on every list/detail page.
- Wrap all DB calls in try/catch → toast on failure ("Unable to connect…").
- **One-time migration**: on app boot, if `localStorage['stpc:v1']` exists and Turso has no rows for this workspace, read the legacy blob, insert everything preserving IDs, then set a `migrated=1` flag in Turso and clear the localStorage blob.

## Phase 1 — Auth / Session Security
- Move session (`userId`, role) from localStorage → `sessionStorage`. Never write auth to localStorage.
- Rewrite `AuthProvider` to hydrate from sessionStorage only; expose `isAuthenticated`.
- `PublicLayout` nav: "Open Dashboard" renders **only** when both sessionStorage token AND context confirm auth; otherwise "Staff Login".
- Global route guard on `/app/*`: verify session on mount, purge + redirect to `/auth` if missing/expired.
- Session ends on tab close (sessionStorage native behavior).

## Phase 2 — OTP Hardening (Forgot Password)
- 5-minute TTL with live countdown (`OTP expires in 4:32`).
- OTP kept in component-local React state; cleaned on unmount / success.
- Attempt counter: 3 wrong → disable Verify, show "Too many failed attempts…".
- Numeric-only masked input, auto-focus.
- Strict `===` compare, wipe on success before redirect.
- Remove "Sent from: …" line under Registered Email ID.

## Phase 3 — Account Lockout
- Track failed logins per user in DB. Roles `therapist`/`reception`/`other`: lock after 4 consecutive fails → "Account locked due to multiple failed attempts. Contact Admin."
- Admin: never locked; add 2s artificial delay on wrong password.
- Admin Settings → Staff & Roles: "Locked Accounts" panel with Unlock button.

## Phase 4 — Prescription / Receipt / Reports fixes
- Fix PDF + WhatsApp export in `PrescriptionDialog` by mirroring the working `app.reports.tsx` jsPDF pattern (no `html2canvas` for the doc body — draw with jsPDF primitives, same header/watermark/footer chrome).
- Footer note pinned to page bottom.
- Fix desktop button overlap on both wizard pages.
- Header shows branch Email ID + configurable clinic URL (`sthairyaphysiocare.pages.dev`) — new toggle + editable field in Admin Settings.
- Receipt: "Qty" → "Sessions". Add "Total in words: Rupees … Only" (number-to-words util).
- Reports: add **Find** button; render first 10 in UI with **Load More**; PDF/CSV buttons appear only after results load.

## Phase 5 — Clinical Scheduling Engine
- New util `src/lib/scheduling.ts`: given a date, fetch all visits + scheduled bookings, compute `[start, start+duration)` blocked intervals; expose `getDisabledSlots(date)` and `checkOverlap(date, start, duration)`.
- Log Visit: rename "Next Review Time Slot" → "Next Review Time"; "Slot Duration" → "Duration"; default "Select Time". "Next Review Date" min = tomorrow. Disable overlapping slots; block submit + toast on forward-overlap.
- Bookings dashboard: propose-new-time date min = tomorrow. Remove "Submissions from the public website appear here."
- Public Book Visit: "Preferred Time Slot" → "Preferred Time", placeholder "Select Time". Preferred Date min = today+1 (24h), auto-skip Sundays / non-working days per selected branch's clinic hours.

## Phase 6 — New "Upcoming Visits" Dashboard
- New route `src/routes/app.upcoming.tsx` + sidebar entry.
- Toggle: Tomorrow / Next 3 Days / Next 7 Days.
- Unified query: visits (`Next Review Date`) + bookings (`status='scheduled'`), merged & sorted chronologically.
- Columns: Name, Contact, Source ("Clinical Appointment" | "Public Web Booking"), Date/Time, Reason.
- "Send Reminder" per row → WhatsApp with source-specific template (clinical vs public). Digits-only sanitization + `+91` fallback.
- Also add "Send Reminder" to existing "Today's Visits" with the "…scheduled visit today…" template.

## Phase 7 — Convert Booking → Patient
- On `scheduled` bookings, add "Convert to Patient" action.
- Field mapping: Full Name→Name, Phone→Mobile, Email→Email, Concern→CC, Preferred Date&Time→Next Scheduled Visit, Preferred Location→Branch (fallback default).
- Opens patient-new form pre-filled; on save marks booking as `closed` and links.

## Phase 8 — Global UI / Branding
- Global watermark + hero background already exist — audit and ensure applied on public routes (home/about/specialities/contact/book).
- Enlarge header/footer/staff-login/staff-shell logos; add "Resilience • Firmness • Balance" tagline under wordmark everywhere.
- Staff login logo + wordmark clickable → `/`.
- About page Vision → "Be the most trusted physiotherapy partner."
- Home CTA email uses `settings.globalEmail`; default globalEmail = `SthairyaPhysiocare@gmail.com`.
- Footer: Mail icon + Global Email; Phone icon + all clinic numbers.
- Contact page: highlight selected branch card with brand tint.
- Book Visit: highlight active channel (In-App / WhatsApp / Email) with brand tint.
- Branch clinic-hours default when blank: Mon–Fri 9–1 & 4–8, Sat 9–1, Sun by appointment.

## Phase 9 — Mobile Patient Profile
- Header: `flex-col` on mobile, name first (bold, full-width, `break-words`), demographics row second (`whitespace-nowrap`, comfortable line-height).
- Actions: separate `flex-wrap` container, `mt-4`.
- Parent card `p-4` / `sm:p-6`.

## Phase 10 — Runtime cleanup
- Fix current hydration mismatch on home page (MapPin/Mail icon divergence causing SSR/CSR mismatch).

---

## Important decisions to confirm before I start

1. **Turso credentials in chat.** You pasted the auth token in plaintext. I will store it via the secret tool (not in code), but I strongly recommend you **rotate that token in the Turso dashboard now** since it's been exposed in this chat history. Confirm you understand.
2. **Async store rewrite is large.** Every route that reads `useStore(...)` becomes a React Query hook + async mutation. Expect churn across ~15 files. Confirm you want the full migration now vs. incrementally per module.
3. **Password re-hash.** Existing localStorage passwords are plaintext. On first migration I'll hash them in place. Users log in normally; no reset needed. OK?
4. **libSQL from the browser.** Using `@libsql/client/web` means the auth token ships to the client (any `VITE_*` env is public). This is acceptable for a small internal clinic app but is **not** a hardened production posture — a real deployment should proxy through a server function. Confirm you accept the tradeoff for now, or want me to route DB calls through TanStack server functions (adds a phase but is materially more secure).
5. **Scope size.** This plan is ~10–15 substantial file changes across auth, store, and 8+ routes plus a new route and new schema. I'll implement top-to-bottom but it will take several turns. OK to proceed?

Reply "go" (and answer Q4: **client** or **server-proxy**) and I'll start with Phase 0.
