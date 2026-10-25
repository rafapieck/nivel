import type { NightDrop } from "@/lib/analysis";
import { DAY_MS } from "@/lib/analysis";

/** Advisory only — never an accusation. */
export default function NightDropCard({ nd }: { nd: NightDrop }) {
  if (!nd.fires) return null;
  const consecutive = nd.nights.some((n, i) => i > 0 && Math.abs(n - nd.nights[i - 1] - DAY_MS) < 2 * 3600000);
  return (
    <section role="note" className="space-y-1 rounded-2xl bg-orange-100 p-4 text-orange-950">
      <p className="text-xl font-semibold">
        Bajada nocturna {nd.nights.length} noches{consecutive ? " seguidas" : ""}
      </p>
      <p className="text-lg">Puede ser una fuga, el flotador o alguien usando agua.</p>
      <p className="text-base">El nivel bajó más de 1% por hora entre las 2 y las 5 a.m., sin que entrara agua.</p>
    </section>
  );
}
