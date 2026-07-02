
## Scope

The prior message packed ~10 phases across DB migration, auth hardening, scheduling engine, prescriptions, reports, and UI polish. To ship this reliably (and stay debuggable) I'll land it in sequenced PR-sized batches, not one mega-commit. Below is the sequence and the key architectural decisions I need your OK on before I start writing code.

## Architectural decisions (need confirmation)

1. **Turso access path — server-proxied, not browser-direct.**
   Lovable blocks user-created `VITE_*` secrets, and for good reason: a browser-embedded libSQL token = anyone viewing the site can read/write the entire DB. I've stored the credentials as server-only secrets (`TURSO_DB_URL`, `TURSO_AUTH_TOKEN`) and will:
   - Create `src/lib/turso.server.ts` — libSQL client, server-only.
   - Expose typed CRUD via `createServerFn` in `src/lib/db/*.functions.ts` (users, patients, visits, bookings, settings, clinicians, branches).
   - Rewrite `src/lib/store.ts` to be an async cache layer backed by TanStack Query + server fns. Existing selectors keep working; components move from sync `useStore(...)` reads to `useSuspenseQuery` where SSR-critical, and lazy `useQuery` elsewhere.
   - Passwords hashed with PBKDF2-SHA256 (Web Crypto, Worker-compatible — bcrypt/argon2 are native Node modules and don't run on Cloudflare Workers).

2. **Session storage.** Auth session moves to `sessionStorage` (as requested). Route guard added at `src/routes/_app.tsx` (pathless layout) — instant redirect to `/auth` if no live session. Nav "Open Dashboard" gated on the same check.

3. **One-time migration.** On first successful DB connect after this deploy, if `localStorage['sthairya_db']` exists AND the Turso `users` table is empty, run a migration server fn that accepts the legacy JSON blob, inserts it preserving IDs, then sets a `localStorage['sthairya_migrated']=1` flag and wipes the legacy blob. Idempotent; safe to re-run.

## Rollout phases (in order)

**Phase A — DB foundation (largest, lands first)**
- `turso.server.ts` client + schema init (users, patients, visits, bookings, branches, settings, clinicians, blocked, sessions-audit) with FKs and `PRAGMA foreign_keys=ON`.
- PBKDF2 password hash + verify helpers.
- Server fns for all CRUD.
- Async store shim so existing components compile; migrate reads route-by-route.
- Migration server fn + client-side one-shot trigger.
- Loading skeletons + error toasts on failed DB calls.

**Phase B — Auth & session hardening**
- sessionStorage-only session; route guard; nav conditional render.
- Password lockout (4 fails → lock; admin exempt + 2s delay).
- Admin "Unlock account" panel in Staff & Roles.
- OTP TTL 5min + countdown + 3-attempt cap + numeric mask + autofocus + wipe-on-success.

**Phase C — Prescription & Receipt fixes**
- Port the Reports PDF pipeline (which works) into `PrescriptionDialog` — same html2canvas+jsPDF flow, same await/rAF sequence.
- Fix WhatsApp send (sanitize number, +91 default, proper `wa.me` URL, no popup blocker).
- Footer note absolute-bottom (flex column, `mt-auto`).
- Desktop button overlap fix (grid gap on preview toolbar).
- Header: branch email + clinic URL (toggle in settings).
- Receipt: "Total in Words" (number-to-words util), "Qty" → "Sessions".

**Phase D — Scheduling engine**
- Duration-aware conflict util (`src/lib/schedule.ts`): given date, returns blocked intervals from visits + scheduled bookings; masks slot picker; forward-overlap check with toast.
- Past date disabling (Log Visit → tomorrow+; Bookings propose → today+).
- Public book form: today+24h minimum, skip non-working days from branch hours.
- Text: "Next Review Time Slot" → "Next Review Time", "Slot Duration" → "Duration", "-No Slot-" → "Select Time".

**Phase E — Bookings → Patient conversion + Upcoming Visits dashboard**
- "Convert to Patient" action on scheduled bookings with field mapping.
- New route `src/routes/app.upcoming.tsx` — Tomorrow / Next 3 / Next 7 filters, merged clinical + public queries, per-source WhatsApp templates.
- Today's Visits: "Send Reminder" WhatsApp button per row.
- Scheduled bookings appear on Today's Visits when date == today.

**Phase F — UI polish, branding, mobile**
- Global watermark + hero background applied to all public routes.
- Larger logos + "Resilience • Firmness • Balance" tagline everywhere.
- Staff login logo enlarged & clickable → `/`.
- About vision text update.
- Footer: Mail/Phone icons linked to global email + all branch phones.
- Contact page: selected-branch highlight ring.
- Book Visit: active channel highlight in brand color.
- "Preferred Time Slot" → "Preferred Time"; "Select 30-min slot" → "Select Time".
- Patient profile mobile: forced vertical stack for name/age/gender/phone, buttons in `flex-wrap` with `mt-4`, `p-4` card padding, `truncate` on name.

**Phase G — Reports + Admin settings misc**
- Reports: Find button → paginated 10-at-a-time UI list → then Export PDF/CSV buttons appear.
- Admin: Global Email default `SthairyaPhysiocare@gmail.com`; editable clinic URL toggle; branch hours editable with default fallback.
- Remove copy: "Sent from: Gana.Plinija@gmail.com" and "Submissions from the public website appear here."

## Technical notes

- Turso client: `@libsql/client/web` inside server fns only. All queries go through server fns; the browser never touches libSQL.
- Password hashing: PBKDF2-SHA256, 210k iterations, 16-byte salt, stored as `pbkdf2$210000$<saltB64>$<hashB64>`.
- Query keys: `['patients']`, `['patients', id]`, `['visits', patientId]`, `['bookings']`, `['users']`, `['settings']`. Mutations invalidate list + detail keys.
- OTP state: local component state only, cleared on unmount via cleanup effect.
- Schedule util is pure — testable in isolation, used by all three date pickers.
- Number-to-words: small Indian-numbering-system util (lakh/crore aware) since libraries add bundle weight.

## Risk & sequencing rationale

Phase A is the biggest and must land alone so we can verify data integrity before layering behavior changes. Phases B–G each touch smaller surface areas and can ship independently. If any phase reveals a Turso schema gap, we fix forward with an additive migration — no destructive changes.

## What I need from you

1. **Confirm the server-proxy architecture** (option A) vs. any preference for browser-direct despite the risk (not recommended, and not possible with current secret policy anyway).
2. **Confirm PBKDF2** for password hashing (Worker-compatible; bcrypt/argon2 aren't).
3. **Go/no-go on Phase A first** — I'll start writing as soon as you say go.
