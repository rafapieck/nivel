-- Nivel · F7: the server computes every share of the pipa cost.
-- Run once in the Supabase SQL Editor, after 20261025000000_nivel_pipa.sql.
-- One transaction: if anything fails, nothing changes.
--
-- share_mxn = quoted price × requested liters ÷ all requested liters, floored to whole
-- pesos. The rounding remainder goes on the coordinator's line (or, if the coordinator
-- didn't request water, on the largest request) and is stored in rounding_mxn so the
-- app can show it. Clients can no longer write share_mxn at all.

begin;

alter table public.nivel_order_shares
  add column rounding_mxn numeric(10, 2) not null default 0;

create function public.nivel_recompute_split(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_price numeric;
  v_coord uuid;
  v_total bigint;
  v_sum numeric;
  v_target uuid;
begin
  select o.quoted_price_mxn, g.coordinator_member_id
    into v_price, v_coord
  from public.nivel_orders o
  join public.nivel_groups g on g.id = o.group_id
  where o.id = p_order_id;

  select coalesce(sum(requested_liters), 0) into v_total
  from public.nivel_order_shares where order_id = p_order_id;
  if v_price is null or v_total = 0 then
    return;
  end if;

  update public.nivel_order_shares
  set share_mxn = floor(v_price * requested_liters / v_total), rounding_mxn = 0
  where order_id = p_order_id;

  select sum(share_mxn) into v_sum
  from public.nivel_order_shares where order_id = p_order_id;

  select member_id into v_target
  from public.nivel_order_shares
  where order_id = p_order_id and member_id = v_coord;
  if v_target is null then
    select member_id into v_target
    from public.nivel_order_shares
    where order_id = p_order_id
    order by requested_liters desc, member_id
    limit 1;
  end if;

  update public.nivel_order_shares
  set share_mxn = share_mxn + (v_price - v_sum), rounding_mxn = v_price - v_sum
  where order_id = p_order_id and member_id = v_target;
end;
$$;

revoke all on function public.nivel_recompute_split(uuid) from public, anon, authenticated;

create function public.nivel_shares_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.nivel_recompute_split(coalesce(new.order_id, old.order_id));
  return null;
end;
$$;

create trigger nivel_order_shares_split
  after insert or delete or update of requested_liters on public.nivel_order_shares
  for each row execute function public.nivel_shares_changed();

create function public.nivel_order_price_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.nivel_recompute_split(new.id);
  return null;
end;
$$;

create trigger nivel_orders_split
  after update of quoted_price_mxn on public.nivel_orders
  for each row execute function public.nivel_order_price_changed();

-- Stamp who/when only for changes a person made (liters or payment), not for the
-- server's own split recalculation. Liters are frozen once the order leaves 'open';
-- payment can always be corrected and never blocks anything.
create or replace function public.nivel_touch_share()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT'
     or new.requested_liters is distinct from old.requested_liters then
    select status into v_status from public.nivel_orders where id = new.order_id;
    if v_status <> 'open' then
      raise exception 'order is no longer open for liter requests' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT'
     or new.requested_liters is distinct from old.requested_liters
     or new.payment_method is distinct from old.payment_method then
    new.updated_at := now();
    new.recorded_by := auth.uid();
  end if;
  return new;
end;
$$;

-- Clients may set liters and payment method only. share_mxn and rounding_mxn are server-owned.
revoke insert, update on public.nivel_order_shares from authenticated;
grant insert (order_id, member_id, requested_liters, payment_method)
  on public.nivel_order_shares to authenticated;
grant update (requested_liters, payment_method)
  on public.nivel_order_shares to authenticated;

-- Recompute any shares created before this migration.
do $$ begin perform public.nivel_recompute_split(id) from public.nivel_orders; end $$;

commit;
