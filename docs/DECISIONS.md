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

**Next first move:** Rafael runs the migration (docs/SUPABASE_SETUP.md); then F7 — group + invite link + offline members + order + split + private payment log.
