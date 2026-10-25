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
