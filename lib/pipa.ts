import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeliveryMode, PaymentMethod } from "./pipaSchemas";

// Pipa data access. Every query runs under RLS with the signed-in user's JWT.

export type Member = {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  is_offline: boolean;
};

export type Group = {
  id: string;
  name: string;
  delivery_mode: DeliveryMode;
  coordinator_member_id: string | null;
  invite_code: string;
  created_at: string;
  nivel_group_members: Member[];
};

export type OrderStatus = "open" | "delivered" | "closed";

export type Order = {
  id: string;
  group_id: string;
  supplier_label: string;
  quoted_liters: number;
  quoted_price_mxn: number;
  status: OrderStatus;
  created_at: string;
};

export type Share = {
  order_id: string;
  member_id: string;
  requested_liters: number;
  share_mxn: number;
  rounding_mxn: number;
  payment_method: PaymentMethod;
  updated_at: string;
};

export type Totals = {
  collected_mxn: number;
  total_mxn: number;
  requested_liters: number;
  shares: number;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  open: "Abierto",
  delivered: "Entregado",
  closed: "Cerrado",
};

// Two FKs link groups and members (members.group_id and the coordinator FK), so the embed
// names the one to follow; otherwise PostgREST rejects it as ambiguous.
const GROUP_COLS =
  "id, name, delivery_mode, coordinator_member_id, invite_code, created_at, nivel_group_members!nivel_group_members_group_id_fkey(id, group_id, user_id, display_name, is_offline)";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Numeric columns come back from PostgREST as strings or numbers; normalise to numbers. */
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export async function listMyGroups(sb: SupabaseClient): Promise<Group[]> {
  return check(await sb.from("nivel_groups").select(GROUP_COLS).order("created_at"));
}

export async function getGroup(sb: SupabaseClient, id: string): Promise<Group | null> {
  return check(await sb.from("nivel_groups").select(GROUP_COLS).eq("id", id).maybeSingle());
}

export async function createGroup(
  sb: SupabaseClient,
  name: string,
  myName: string,
  mode: DeliveryMode,
): Promise<string> {
  return check(
    await sb.rpc("nivel_create_group", { p_name: name, p_display_name: myName, p_delivery_mode: mode }),
  );
}

export async function joinGroup(sb: SupabaseClient, code: string, myName: string): Promise<string> {
  return check(await sb.rpc("nivel_join_group", { p_invite_code: code, p_display_name: myName }));
}

export async function addOfflineMember(sb: SupabaseClient, groupId: string, name: string, userId: string) {
  check(
    await sb.from("nivel_group_members").insert({
      group_id: groupId,
      display_name: name,
      is_offline: true,
      added_by: userId,
    }),
  );
}

export async function listOrders(sb: SupabaseClient, groupId: string): Promise<Order[]> {
  const rows = check(
    await sb.from("nivel_orders").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
  ) as Order[];
  return rows.map((o) => ({ ...o, quoted_price_mxn: num(o.quoted_price_mxn) }));
}

export async function getOrder(sb: SupabaseClient, id: string): Promise<Order | null> {
  const o = check(await sb.from("nivel_orders").select("*").eq("id", id).maybeSingle()) as Order | null;
  return o && { ...o, quoted_price_mxn: num(o.quoted_price_mxn) };
}

export async function openOrder(
  sb: SupabaseClient,
  groupId: string,
  userId: string,
  input: { supplierLabel: string; quotedLiters: number; quotedPriceMxn: number },
): Promise<string> {
  const row = check(
    await sb
      .from("nivel_orders")
      .insert({
        group_id: groupId,
        supplier_label: input.supplierLabel,
        quoted_liters: input.quotedLiters,
        quoted_price_mxn: input.quotedPriceMxn,
        status: "open",
        created_by: userId,
      })
      .select("id")
      .single(),
  ) as { id: string };
  return row.id;
}

export async function setOrderStatus(sb: SupabaseClient, id: string, status: OrderStatus) {
  check(await sb.from("nivel_orders").update({ status }).eq("id", id));
}

/** RLS returns only the caller's own row, or every row for the coordinator. */
export async function listShares(sb: SupabaseClient, orderId: string): Promise<Share[]> {
  const rows = check(await sb.from("nivel_order_shares").select("*").eq("order_id", orderId)) as Share[];
  return rows.map((s) => ({ ...s, share_mxn: num(s.share_mxn), rounding_mxn: num(s.rounding_mxn) }));
}

/**
 * Sets liters and/or payment for one member. The server computes share_mxn; clients can't write it.
 * Update first, insert if there was no row (an upsert would need UPDATE on the key columns).
 */
export async function saveShare(
  sb: SupabaseClient,
  orderId: string,
  memberId: string,
  patch: { requested_liters?: number; payment_method?: PaymentMethod },
) {
  const updated = check(
    await sb
      .from("nivel_order_shares")
      .update(patch)
      .eq("order_id", orderId)
      .eq("member_id", memberId)
      .select("member_id"),
  ) as unknown[];
  if (updated.length > 0) return;
  if (patch.requested_liters === undefined) throw new Error("Primero pide litros");
  check(await sb.from("nivel_order_shares").insert({ order_id: orderId, member_id: memberId, ...patch }));
}

export async function getTotals(sb: SupabaseClient, orderId: string): Promise<Totals | null> {
  const rows = check(await sb.rpc("nivel_order_totals", { p_order_id: orderId })) as Totals[];
  const t = rows[0];
  return t
    ? {
        collected_mxn: num(t.collected_mxn),
        total_mxn: num(t.total_mxn),
        requested_liters: num(t.requested_liters),
        shares: num(t.shares),
      }
    : null;
}

export function coordinatorOf(g: Group): Member | undefined {
  return g.nivel_group_members.find((m) => m.id === g.coordinator_member_id);
}

export function myMember(g: Group, userId: string): Member | undefined {
  return g.nivel_group_members.find((m) => m.user_id === userId);
}

/** Friendly Spanish message for errors coming back from Supabase. */
export function errorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/no longer open/.test(msg)) return "El pedido ya no acepta cambios de litros.";
  if (/invite not found/.test(msg)) return "Esa invitación no existe o ya no es válida.";
  if (/row-level security|permission denied/.test(msg)) return "No tienes permiso para hacer eso.";
  if (/check constraint/.test(msg)) return "Algún valor está fuera del rango permitido.";
  return "Algo salió mal. Intenta de nuevo.";
}
