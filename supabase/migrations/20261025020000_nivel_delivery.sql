-- Nivel · F8: delivery, approved tank summaries and discrepancies.
-- Run once in the Supabase SQL Editor, after 20261025010000_nivel_server_split.sql.
-- One transaction: if anything fails, nothing changes.
--
-- Observed and estimated liters are computed by the server from the summaries tank owners
-- chose to share; the coordinator records only the time, the fill minutes and a note.
-- Cistern mode: only the shared cistern's summary counts (tinacos are refilled by a pump).
-- Tinacos mode: observed = sum of the shared tinaco deltas, "N de M" with M = households.

begin;

-- Water the owner's own phone estimates was used during the fill (rate × fill minutes).
-- One number, not a time series.
alter table public.nivel_tank_summaries
  add column use_during_fill_l numeric(10, 1)
  check (use_during_fill_l between 0 and 20000);

-- ---------------------------------------------------------------------------
-- Deliveries: server fills the derived columns
-- ---------------------------------------------------------------------------

create function public.nivel_delivery_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_mode text;
  v_group uuid;
begin
  select o.quoted_liters, o.group_id, g.delivery_mode
    into new.quoted_liters, v_group, v_mode
  from public.nivel_orders o
  join public.nivel_groups g on g.id = o.group_id
  where o.id = new.order_id;

  new.observed_liters := null;
  new.estimated_liters := null;
  new.observed_tanks_reported := 0;
  new.observed_tanks_total := case
    when v_mode = 'cistern' then 1
    else (select count(*) from public.nivel_group_members where group_id = v_group)
  end;
  new.recorded_by := auth.uid();
  return new;
end;
$$;

create trigger nivel_deliveries_defaults
  before insert on public.nivel_deliveries
  for each row execute function public.nivel_delivery_defaults();

create function public.nivel_delivery_marks_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.nivel_orders set status = 'delivered'
  where id = new.order_id and status = 'open';
  return null;
end;
$$;

create trigger nivel_deliveries_mark_order
  after insert on public.nivel_deliveries
  for each row execute function public.nivel_delivery_marks_order();

create function public.nivel_refresh_delivery(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_mode text;
  v_observed numeric;
  v_use numeric;
  v_reported integer;
begin
  select g.delivery_mode into v_mode
  from public.nivel_orders o
  join public.nivel_groups g on g.id = o.group_id
  where o.id = p_order_id;

  if v_mode = 'cistern' then
    -- The first approved cistern summary is the observation.
    select s.delta_l, coalesce(s.use_during_fill_l, 0), 1
      into v_observed, v_use, v_reported
    from public.nivel_tank_summaries s
    where s.order_id = p_order_id and s.tank_type = 'cisterna'
    order by s.approved_at
    limit 1;
  else
    select sum(s.delta_l), sum(coalesce(s.use_during_fill_l, 0)), count(*)
      into v_observed, v_use, v_reported
    from public.nivel_tank_summaries s
    where s.order_id = p_order_id and s.tank_type = 'tinaco';
  end if;

  update public.nivel_deliveries
  -- greatest() ignores nulls, so keep "not observed" explicit.
  set observed_liters = case when v_observed is null then null else greatest(0, v_observed) end,
      estimated_liters = case when v_observed is null then null else greatest(0, v_observed + v_use) end,
      observed_tanks_reported = coalesce(v_reported, 0)
  where order_id = p_order_id;
end;
$$;

revoke all on function public.nivel_refresh_delivery(uuid) from public, anon, authenticated;

create function public.nivel_summary_added()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.nivel_refresh_delivery(new.order_id);
  return null;
end;
$$;

create trigger nivel_tank_summaries_refresh
  after insert on public.nivel_tank_summaries
  for each row execute function public.nivel_summary_added();

-- A summary can only be shared once the delivery exists, for an order that isn't closed.
drop policy nivel_summaries_insert on public.nivel_tank_summaries;
create policy nivel_summaries_insert on public.nivel_tank_summaries
  for insert to authenticated
  with check (
    public.nivel_is_my_member_in_order(member_id, order_id)
    and exists (select 1 from public.nivel_deliveries d where d.order_id = nivel_tank_summaries.order_id)
    and exists (
      select 1 from public.nivel_orders o
      where o.id = nivel_tank_summaries.order_id and o.status <> 'closed'
    )
  );

-- ---------------------------------------------------------------------------
-- Discrepancies: the server stamps who resolved it and when; no reopening.
-- ---------------------------------------------------------------------------

create function public.nivel_discrepancy_resolve()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'resolved' then
    raise exception 'discrepancy already resolved' using errcode = 'P0001';
  end if;
  if new.status = 'resolved' then
    new.handled_by := auth.uid();
    new.resolved_at := now();
  end if;
  return new;
end;
$$;

create trigger nivel_discrepancies_resolve
  before update on public.nivel_discrepancies
  for each row execute function public.nivel_discrepancy_resolve();

-- ---------------------------------------------------------------------------
-- Grants: clients write only what a person decides.
-- ---------------------------------------------------------------------------

revoke insert, update on public.nivel_deliveries from authenticated;
grant insert (order_id, delivered_at, fill_minutes, notes) on public.nivel_deliveries to authenticated;
grant update (notes) on public.nivel_deliveries to authenticated;

revoke insert on public.nivel_tank_summaries from authenticated;
grant insert (
  order_id, member_id, tank_type, before_l, after_l, delta_l,
  calibration_snapshot, concurrent_use_note, use_during_fill_l
) on public.nivel_tank_summaries to authenticated;

revoke update on public.nivel_discrepancies from authenticated;
grant update (status, resolution_note) on public.nivel_discrepancies to authenticated;

commit;
