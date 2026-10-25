import { TANK_TYPE_LABEL, type Calibration } from "@/lib/calibration";
import { fmtDateTime, fmtInt } from "@/lib/format";

export default function CalibrationSummary({ cal }: { cal: Calibration }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-base">
      <dt className="text-slate-600">Tipo</dt>
      <dd className="font-semibold">{TANK_TYPE_LABEL[cal.type]}</dd>
      <dt className="text-slate-600">Capacidad</dt>
      <dd className="font-semibold">{fmtInt(cal.capacityL)} L</dd>
      <dt className="text-slate-600">Lleno</dt>
      <dd className="font-semibold">{cal.dFullCm} cm</dd>
      <dt className="text-slate-600">Vacío</dt>
      <dd className="font-semibold">{cal.dEmptyCm} cm</dd>
      <dt className="text-slate-600">Calibrado</dt>
      <dd className="font-semibold">{fmtDateTime(cal.createdAt)}</dd>
    </dl>
  );
}
