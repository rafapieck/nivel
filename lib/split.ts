// Mirror of the server's nivel_recompute_split (SQL is authoritative; this is for tests and previews).
// Each share = price × liters ÷ total liters, floored to whole pesos. The remainder goes on the
// coordinator's line, or on the largest request if the coordinator didn't ask for water.

export type ShareRequest = { memberId: string; liters: number };
export type SplitLine = { memberId: string; shareMxn: number; roundingMxn: number };

export function splitCost(
  priceMxn: number,
  requests: ShareRequest[],
  coordinatorMemberId: string | null,
): SplitLine[] {
  const total = requests.reduce((a, r) => a + r.liters, 0);
  if (total === 0) return requests.map((r) => ({ memberId: r.memberId, shareMxn: 0, roundingMxn: 0 }));

  const priceCents = Math.round(priceMxn * 100);
  const lines = requests.map((r) => ({
    memberId: r.memberId,
    cents: Math.floor((priceCents * r.liters) / (total * 100)) * 100,
    roundingCents: 0,
  }));
  const remainder = priceCents - lines.reduce((a, l) => a + l.cents, 0);

  const target =
    lines.find((l) => l.memberId === coordinatorMemberId) ??
    [...lines].sort((a, b) => {
      const la = requests.find((r) => r.memberId === a.memberId)!.liters;
      const lb = requests.find((r) => r.memberId === b.memberId)!.liters;
      return lb - la || (a.memberId < b.memberId ? -1 : 1);
    })[0];
  target.cents += remainder;
  target.roundingCents = remainder;

  return lines.map((l) => ({
    memberId: l.memberId,
    shareMxn: l.cents / 100,
    roundingMxn: l.roundingCents / 100,
  }));
}
