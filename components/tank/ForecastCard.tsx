import type { TankAnalysis } from "@/lib/analysis";
import { fmtDays, fmtOneDecimal } from "@/lib/format";
import MlTag from "./MlTag";

/**
 * Days remaining. Leads with whichever estimate won the 24 h held-out check, and always
 * shows the other one plus both errors next to it.
 */
export default function ForecastCard({ a }: { a: TankAnalysis }) {
  const { current, ml, heldOut, lead, days, baselineDays } = a;

  if (!current || (!ml && a.baseline === null)) {
    return (
      <Card>
        <p className="text-xl font-semibold">Aún no hay suficientes lecturas</p>
        <p className="text-base text-slate-600">
          Para estimar cuántos días te alcanza se necesitan al menos unas 6 horas de lecturas sin
          entradas de agua.
        </p>
      </Card>
    );
  }

  if (!days) {
    return (
      <Card>
        <p className="text-xl font-semibold">El nivel casi no está bajando</p>
        <p className="text-base text-slate-600">
          Con este consumo no se puede estimar en cuántos días se acaba.
        </p>
      </Card>
    );
  }

  const mlDays = ml && ml.litersPerDay > 0 ? current.liters / ml.litersPerDay : null;
  const errors = heldOut
    ? `Qué tanto falló en las últimas 24 h: ML ±${fmtOneDecimal(heldOut.mlMaeL)} L · base ±${fmtOneDecimal(heldOut.baselineMaeL)} L`
    : "Aún no hay 24 h extra para ver qué tanto falla.";

  return (
    <Card>
      <p className="text-2xl font-semibold">Te alcanza para unos {fmtDays(days)} días</p>
      {lead === "ml" ? (
        <p className="flex flex-wrap items-center gap-1 text-base text-slate-700">
          <MlTag>Estimación (ML · aprendizaje automático)</MlTag>
          {baselineDays !== null && <span>· Base simple: {fmtOneDecimal(baselineDays)} días</span>}
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-1 text-base text-slate-700">
          <MlTag>Base simple</MlTag>
          {mlDays !== null && <span>· Estimación (ML · aprendizaje automático): {fmtOneDecimal(mlDays)} días</span>}
        </p>
      )}
      <p className="text-sm text-slate-600">{errors}</p>
      <p className="text-sm text-slate-600">
        {heldOut
          ? lead === "ml"
            ? "La estimación con aprendizaje automático acertó mejor que la base simple, por eso va primero."
            : "La base simple acertó mejor que la estimación con aprendizaje automático, por eso va primero."
          : "Mientras no se pueda ver qué tanto falla, va primero la base simple."}
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">{children}</section>;
}
