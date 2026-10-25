import { z } from "zod";

export const displayName = z
  .string()
  .trim()
  .min(1, "Escribe un nombre")
  .max(60, "Máximo 60 caracteres");

export const liters = z
  .number({ error: "Escribe los litros" })
  .int("Usa litros enteros")
  .min(1, "Los litros deben estar entre 1 y 20,000")
  .max(20000, "Los litros deben estar entre 1 y 20,000");

export const priceMxn = z
  .number({ error: "Escribe el precio" })
  .min(0, "El precio debe estar entre $0 y $50,000")
  .max(50000, "El precio debe estar entre $0 y $50,000")
  .refine((n) => Math.round(n * 100) === n * 100, "Máximo dos decimales");

export const DELIVERY_MODES = ["cistern", "tinacos"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  cistern: "Cisterna compartida",
  tinacos: "Directo a cada tinaco",
};

export const PAYMENT_METHODS = ["cash", "transfer", "pending"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  pending: "Pendiente",
};

export const createGroupInput = z
  .object({ name: displayName, myName: displayName, mode: z.enum(DELIVERY_MODES) })
  .strict();

export const openOrderInput = z
  .object({
    supplierLabel: displayName,
    quotedLiters: liters,
    quotedPriceMxn: priceMxn,
  })
  .strict();

export const inviteCode = z.string().regex(/^[0-9a-f]{16}$/, "Invitación inválida");

/** Parses "1,200.50" / "1200,5" style input into a number (NaN when empty). */
export const toNumber = (s: string) => {
  const t = s.trim().replace(/\s/g, "");
  if (t === "") return NaN;
  // Commas as thousands separators when a dot is present, otherwise as decimal mark.
  return Number(t.includes(".") ? t.replace(/,/g, "") : t.replace(",", "."));
};
