import type { ArrivalPattern } from "@/lib/analysis";

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export default function ArrivalSection({ p }: { p: ArrivalPattern | null }) {
  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="arrivals">
      <h2 id="arrivals" className="text-xl font-bold">
        ¿Cuándo llega el agua?
      </h2>
      {!p ? (
        <p className="text-lg text-slate-700">
          Aún no hay suficiente historial para estimar cuándo llega el agua.
        </p>
      ) : (
        <>
          <p className="text-base text-slate-700">
            {p.total} entradas de agua en {p.weeks} semanas, por día de la semana.{" "}
            <strong>Patrón, no predicción.</strong>
          </p>
          <ArrivalBars counts={p.byWeekday} />
        </>
      )}
    </section>
  );
}

function ArrivalBars({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  return (
    <ul className="grid grid-cols-7 items-end gap-1" aria-label="Entradas de agua por día">
      {counts.map((c, i) => (
        <li key={DAYS[i]} className="flex flex-col items-center gap-1" title={`${DAYS[i]}: ${c}`}>
          <span className="text-sm font-semibold text-slate-800">{c || ""}</span>
          <span
            className="w-full rounded-t bg-blue-700"
            style={{ height: `${Math.max(2, (c / max) * 72)}px`, opacity: c ? 1 : 0.15 }}
          />
          <span className="text-sm text-slate-600">{DAYS[i]}</span>
        </li>
      ))}
    </ul>
  );
}
