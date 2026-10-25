# DECISIONS — Nivel

## 2026-10-24
- Measure the tinaco, not the meter: under tandeo the meter spins on air.
- Tank module works offline with no account; raw readings only in IndexedDB (Blueprint condition 1, my TECHNOLOGIST dissent: sharing must not become surveillance).
- Sensing this week = labeled simulator + CSV in real ESP32 format + manual entry. Firmware/Bluetooth deferred.
- ML is in-browser regression + changepoint detection, always shown next to a simple baseline with held-out error (condition 6). No LLM.
- No arrival forecast without ≥6 arrivals over ≥3 weeks (condition 6).
- Payment status private to member + coordinator; group sees only totals (shadow clause).
- Quoted / observed / estimated liters stored separately; gaps open a discrepancy for the named coordinator, never an accusation (conditions 3, 4).

**Tomorrow's first move:** create repo `rafapieck/nivel`, commit `docs/PACKET.md` + `docs/mockup.png` before any code, then F1.

## 2026-10-25
- Shipped Step 0 and F1–F5 straight to `main` (Vercel deploys from `main`).
- Readings are converted with the calibration snapshot they were stored under; recalibrating never rewrites old readings. Out-of-range readings are flagged and left out of the analysis (count shown on the dashboard).
- Water-in = rise ≥ 3% of capacity that still holds 30 min after it ends (median-of-3 smoothing drops single spikes). This also catches fast pump fills.
- Days remaining = current liters ÷ winning rate, widened by ±1 residual std on the level and by the winner's held-out 24 h error relative to daily use; rounded out to half days. Below 0.5% of capacity/day we say the level is barely dropping instead of giving a number.
- Held-out ties go to the baseline; with no 24 h held out yet, the baseline leads.
- Arrival pattern needs ≥ 6 events spanning ≥ 14 days across ≥ 3 calendar weeks.
- Night-drop windows use the phone's local clock; tests pin `America/Mexico_City`.
- Re-importing a CSV skips timestamps already stored; loading a simulation replaces only simulated readings.
- `cacheComponents` keeps visited routes mounted (hidden); data hooks reload in effects, which re-run when a route becomes visible.

**Next first move (superseded):** F6 — done below.

### F6 (same day)
- Supabase project is shared with La Suma: every table and function is prefixed `nivel_`; the migration touches nothing else and runs in one transaction.
- Groups are created and joined only through `nivel_create_group` / `nivel_join_group` (security definer), which avoids the group↔coordinator chicken-and-egg under RLS. The coordinator FK is composite, so the coordinator must be a member of that group.
- Column-level grants back up RLS: nobody can change `coordinator_member_id`, `recorded_by` or `raised_by` from the client; anon gets nothing.
- `nivel_tank_summaries.calibration_snapshot` is limited to exactly four keys by a check constraint, and `delta_l = after_l − before_l`, so the server rejects a smuggled time series even if the client's strict Zod were bypassed.
- Auth is browser-only (supabase-js, PKCE) with `redirectTo = <origin>/auth/callback`; no server cookies or proxy needed because every query runs under RLS with the user's JWT.
- Verified locally on Postgres 16 with a mocked `auth` schema: anon denied; outsider sees nothing; payment rows visible only to the owner and the coordinator; the coordinator writes offline rows only; strict snapshot; discrepancies visible to raiser + coordinator, resolvable only by the coordinator, never deletable; pending offline member doesn't block closing.
- Known gap for F7: `share_mxn` is still written by the client; F7 should compute the split server-side (or validate it) when the coordinator finalises the order.

**Next first move (superseded):** F7 — done below.

### F7–F9 (same day)
- **Split is server-owned** (migration `20261025010000`): `nivel_recompute_split` runs on every change of liters or price; each share is floored to whole pesos and the remainder goes on the coordinator's line (largest request if the coordinator asked for no water), stored in `rounding_mxn` and shown. Clients have no INSERT/UPDATE on `share_mxn`/`rounding_mxn`. `lib/split.ts` mirrors it for tests (packet test 7).
- Liters freeze once the order leaves `open`; payment method can always be corrected and never gates delivery or closing.
- Server-side stamping only for human changes (liters/payment), so recomputing the split doesn't overwrite `recorded_by` on other people's rows.
- The group embed names `nivel_group_members_group_id_fkey`: two FKs link groups and members, and PostgREST would otherwise reject the embed as ambiguous.
- Pipa pages use query strings (`/pipa/grupo?id=`, `/pipa/pedido?id=`, `/pipa/unirse?c=`) under Suspense; the invite code survives the Google round trip in sessionStorage.
- **Delivery is server-derived** (migration `20261025020000`): the coordinator sends only time, fill minutes and a note; the server fills quoted liters and N-of-M, and recomputes observed/estimated when a summary is shared. Cistern mode counts only the cistern summary; tinacos mode sums tinaco deltas with M = households.
- Estimated = observed + each reporting owner's own `use_during_fill_l` (their phone's rate × fill minutes), a single number per summary — the server never sees rates or series.
- Summaries: strict Zod on the phone and a 4-key check constraint on the server; allowed only after the delivery exists and before the order closes. "No compartir" is remembered per order in localStorage and sends nothing.
- Discrepancy button appears at > 15% quoted-vs-observed gap; the server stamps `handled_by`/`resolved_at` and blocks reopening; no delete.
- `/costo` starts empty and shows totals only; no savings or ROI computed.
- Verified: SQL flows on local Postgres 16 with a mocked Supabase auth schema (split math, tampering, liter lock, tests 11–15, both delivery modes); UI flows in Playwright against a mocked PostgREST, checking exactly what each screen sends. Not verified against the live project until Rafael runs migrations 2 and 3.

**Next first move:** Rafael runs `20261025010000_nivel_server_split.sql` then `20261025020000_nivel_delivery.sql`; then a live run of packet test 11 with two Google accounts (screenshot of the Supabase query) and the RLS-policies screenshot for the security floor.

### Persona-test fix (same day)
- Synthetic user Doña Carmen (61, no sensor, no tape measure) got lost on the tank screens. Fixed the worst confusion with plain Spanish:
  - Simulated-data banner now reads **"DATOS DE PRUEBA — NO SON DE TU TINACO"** (still yellow, still on every simulated screen — Blueprint condition 6). The simulator source is labeled "Datos de prueba" everywhere.
  - Tank form: title "Tu tinaco", first line "Con esto te decimos cuántos días de agua te quedan.", helpers explain measuring from the lid with a tape or marked stick, and that empty distance is the tank's inside height ("No tienes que vaciarlo"). No "sensor" on the form; the blind-zone note now says it only matters for electronic meters.
  - Lecturas order: "Medir a mano" first, then "Probar con datos de prueba", then "Si tienes un sensor" (CSV).
  - Forecast tag reads "Estimación (ML · aprendizaje automático)" (also on the delivery column and the summary note); "Error" became "Qué tanto falló en las últimas 24 h".
