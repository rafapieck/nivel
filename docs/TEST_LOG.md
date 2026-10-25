# Test log — mechanical pass (2026-10-25)

Run against `main` at `c189218` (after the fix below). Automated: `npm test` (Vitest, 54 tests). Manual UI checks: Playwright at 380 px on a production build. Database checks: the three migrations applied to a local Postgres 16 with a mocked Supabase `auth` schema and `anon`/`authenticated` roles. The live Supabase project was **not** queried from here (no credentials in this environment); Rafael ran all three migrations there with "Success".

## Packet §12

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Calibration: d_full → 100 %, d_empty → 0 %, outside → clamped **and** flagged | pass | `lib/calibration.test.ts` (5 cases). |
| 2 | Water-in finds 2 events in "tandeo", none in "flat" | pass | `lib/analysis.test.ts`, 6 end times × 3 seeds; also none in "normal", spike and < 30 min rises ignored. |
| 3 | Rate regression on linear data within 2 % | pass | 200 L/day recovered with ±1 L jitter; water-in segments excluded. |
| 4 | Night drop fires on "leak", not "normal", not "night_refill" | pass | 18 runs each. |
| 5 | Held-out MAE for ML and baseline; dashboard leads with the winner | pass | Includes a constructed case where the baseline wins and leads. |
| 6 | Arrival forecast refuses with < 6 arrivals | pass | Also refuses 6 arrivals packed into < 3 weeks; 4-week history gives a Tue/Fri histogram. |
| 7 | Cost split sums exactly, offline member included, remainder on coordinator line | pass | `lib/split.test.ts` (incl. 200 random splits) and the server's `nivel_recompute_split` (1000 → 334/333/333; 1234.50 sums exactly). |
| 8 | Estimated = observed + rate × fill; null when observed is null | pass | `lib/analysis.test.ts`; server equivalent checked in SQL (400 → 408). |
| 9 | Tank module with no account; readings survive reload; no request carries readings | pass | Manual reading saved and still there after reload; zero non-GET requests and zero requests off the app's origin on the tank screens. |
| 10 | CSV import rejects malformed rows with a message, accepts valid ones | pass | 5-row file: 2 imported, rows 3/4/5 reported ("Fecha no reconocida", "0 y 400 cm", "Se esperaban 2 columnas"). Re-import doesn't duplicate. |
| 11 | User B can't read user A's payment row; `order_totals` returns totals only | pass (local DB) | B sees only their own row; querying A's row returns 0 rows; `nivel_order_totals` returns one row (collected, total, liters, count). To repeat live with two Google accounts. |
| 12 | Rejecting the share inserts nothing; delivery shows "no observado" | pass | UI: "No compartir" sent no request, survived reload. DB: observed stays NULL until a counted summary exists (cistern mode with only a tinaco summary also stays NULL). |
| 13 | Summary payload with extra `readings` field rejected | pass | Client strict Zod (`lib/summary.test.ts`) and server check constraint both reject it; shared payload in the UI had exactly 9 fields. |
| 14 | 20 % gap opens a discrepancy visible only to coordinator and raiser; can't be deleted | pass (local DB + mocked UI) | Third member sees 0; no DELETE grant or policy; only the coordinator resolves; reopening blocked. |
| 15 | Offline member with `pending` still in the delivery; order can close | pass | Listed in "Entrega para…"; order closed with the offline share still pending. |
| 16 | Simulated screens show the yellow banner, real-data screens the green one, every ML number tagged | pass | Yellow "DATOS DE PRUEBA — NO SON DE TU TINACO" on Tinaco, Historial, Lecturas and the pipa summary; green "DATOS REALES" with manual/CSV data; ML tags on the forecast, the delivery "Estimados" column and the use-during-fill note. |

## Security floor

| Check | Result | Notes |
|-------|--------|-------|
| `git grep` for keys | pass | No `sb_publishable_…`, `sb_secret_…`, `service_role` or JWTs in the tree or history; only `.env.example` with empty values. |
| RLS on all 7 `nivel_` tables | pass (local DB) | `rowsecurity = true` on all 7. No DELETE policy anywhere, no DELETE grant, no privileges for `anon`. Live screenshot (Authentication → Policies, filter `nivel_`) still to take. |
| Zod limits on every input | pass after fix | Names ≤ 60 (group, member, offline member, supplier; inputs also capped at 60 chars), liters 1–20,000 (order and shares), price 0–50,000, distance 0–400 cm (calibration, manual, CSV), capacity 1–20,000, fill 0–1,440 min, notes/discrepancies ≤ 500. **Before the fix, values with a thousands comma slipped through with the wrong size** (see below). |
| Seed/demo data labeled "datos inventados" | pass | No seed data in the database; simulator labeled as test data. |

## Bug found → fix → commit

**Bug.** Number inputs replaced the first comma with a decimal point. In Mexico the comma is the thousands separator, and the tank form's own hint says "por ejemplo 1,100 L". Typing exactly that saved a **1.1 L** tinaco. Zod accepted it because 1.1 is inside 1–20,000. Every days-remaining number after that would have been wrong. The same parsing in the Pipa forms turned "10,000" liters into **10 L** and a "$1,200" price into **$1.20**, both valid by the limits.

**Fix.** A single `parseNumberMx` (`lib/number.ts`) used by every form. It reads commas as thousands separators, keeps a lone decimal comma ("12,5"), ignores spaces and a leading "$", and returns NaN for ambiguous input such as "1.200,50", so the form asks again instead of guessing.

**Test that would have caught it.** `lib/number.test.ts`. It fails on the old parsing (`expected 1.1 to be 1100`) and checks that the calibration schema receives 1100 for "1,100" and that order liters/price keep their real size.

**Commit.** `c189218` — `fix: mechanical pass — read 1,100 as eleven hundred, not 1.1`.

## Not covered here

- Live Supabase queries (test 11 with two real Google accounts, policies screenshot): need Rafael's accounts.
- Full UI against a live PostgREST: pipa screens were checked against a mocked API that records each request; SQL behaviour was checked separately on Postgres.
