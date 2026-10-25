"use client";

import Link from "next/link";
import DataBanner from "@/components/DataBanner";
import type { TankData } from "@/lib/tank";
import { fmtInt } from "@/lib/format";
import ArrivalSection from "./ArrivalSection";
import ForecastCard from "./ForecastCard";
import LevelChart from "./LevelChart";
import NightDropCard from "./NightDropCard";
import TankIllustration from "./TankIllustration";

export default function TankDashboard({ data }: { data: TankData }) {
  const { cal, samples, analysis: a, sources, outOfRange } = data;

  return (
    <div className="space-y-4">
      <DataBanner sources={sources} />
      {a.current ? (
        <TankIllustration liters={a.current.liters} capacityL={cal.capacityL} />
      ) : (
        <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xl font-semibold">Aún no hay lecturas</p>
          <p className="text-base text-slate-600">
            Mide a mano cuánta agua tienes, o prueba la app con datos de prueba.
          </p>
        </section>
      )}
      {a.current && <ForecastCard a={a} />}
      <LevelChart samples={samples} events={a.events} capacityL={cal.capacityL} />
      <NightDropCard nd={a.nightDrop} />
      {a.current && <ArrivalSection p={a.arrivals} />}
      {outOfRange > 0 && (
        <p className="text-base text-slate-600">
          {fmtInt(outOfRange)} lecturas quedaron fuera del rango calibrado y no se usaron.
        </p>
      )}
      <Link
        href="/lecturas"
        className="flex min-h-14 items-center justify-center rounded-xl bg-blue-700 text-lg font-semibold text-white"
      >
        Agregar lecturas
      </Link>
      <p className="text-sm text-slate-600">
        Supone un tinaco cilíndrico vertical. Tus lecturas se quedan en este teléfono.
      </p>
    </div>
  );
}
