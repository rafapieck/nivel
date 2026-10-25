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

**Next first move:** F6 — Supabase migration (7 tables, RLS, `order_totals`), Google sign-in inside the Pipa tab, and click-by-click steps for Rafael.
