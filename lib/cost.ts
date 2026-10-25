import { z } from "zod";

// Total-cost worksheet (/costo). Every input starts empty; nothing is a claimed saving.

const money = z.number().min(0, "No puede ser negativo").max(50000, "Máximo $50,000");
const minutes = z.number().min(0, "No puede ser negativo").max(1440, "Máximo 1,440 minutos");

export const costInputs = z
  .object({
    sensorMxn: money,
    installMxn: money,
    supportMxnMonth: money,
    nivelMinutesPerOrder: minutes,
    ordersPerMonth: z.number().int("Usa un número entero").min(0, "No puede ser negativo").max(100, "Máximo 100"),
    whatsappMinutesPerOrder: minutes,
  })
  .partial()
  .strict();

export type CostInputs = z.infer<typeof costInputs>;

export type CostTotals = {
  upfrontMxn: number | null;
  firstYearMxn: number | null;
  nivelMinutesMonth: number | null;
  whatsappMinutesMonth: number | null;
};

const sum = (...xs: (number | undefined)[]) =>
  xs.some((x) => x === undefined) ? null : xs.reduce<number>((a, x) => a + (x as number), 0);

/** Totals only; a total stays null until every input it needs is filled in. */
export function costTotals(i: CostInputs): CostTotals {
  const upfront = sum(i.sensorMxn, i.installMxn);
  return {
    upfrontMxn: upfront,
    firstYearMxn:
      upfront === null || i.supportMxnMonth === undefined ? null : upfront + 12 * i.supportMxnMonth,
    nivelMinutesMonth:
      i.nivelMinutesPerOrder === undefined || i.ordersPerMonth === undefined
        ? null
        : i.nivelMinutesPerOrder * i.ordersPerMonth,
    whatsappMinutesMonth:
      i.whatsappMinutesPerOrder === undefined || i.ordersPerMonth === undefined
        ? null
        : i.whatsappMinutesPerOrder * i.ordersPerMonth,
  };
}
