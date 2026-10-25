"use client";

import { useCallback, useEffect, useState } from "react";
import { getAllReadings, listCalibrations } from "./db";
import { buildTankData, type TankData } from "./tank";

/** undefined while loading, null when no tank is declared yet. */
export function useTankData() {
  const [data, setData] = useState<TankData | null | undefined>(undefined);

  const reload = useCallback(
    () =>
      Promise.all([listCalibrations(), getAllReadings()]).then(([cals, readings]) =>
        setData(buildTankData(cals, readings)),
      ),
    [],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, reload };
}
