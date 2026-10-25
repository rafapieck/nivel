import type { ReadingSource } from "@/lib/readings";

/** Yellow for simulated data, green for CSV/manual data. Both when the screen mixes them. */
export default function DataBanner({ sources }: { sources: Iterable<ReadingSource> }) {
  const set = new Set(sources);
  const simulated = set.has("simulated");
  const real = set.has("csv") || set.has("manual");
  if (!simulated && !real) return null;
  return (
    <div className="space-y-1">
      {simulated && (
        <p
          role="status"
          className="rounded-lg bg-yellow-300 px-3 py-2 text-center text-base font-bold tracking-wide text-yellow-950"
        >
          DATOS DE PRUEBA — NO SON DE TU TINACO
        </p>
      )}
      {real && (
        <p
          role="status"
          className="rounded-lg bg-green-600 px-3 py-2 text-center text-base font-bold tracking-wide text-white"
        >
          DATOS REALES
        </p>
      )}
    </div>
  );
}
