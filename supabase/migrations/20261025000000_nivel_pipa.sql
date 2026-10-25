-- Nivel · pipa module schema (week 11)
-- Shared Supabase project: every object is prefixed `nivel_`; nothing else is touched.
-- Paste the whole file into the Supabase SQL Editor and run it once. It runs in one
-- transaction: if anything fails, nothing is created.
--
-- Raw tank readings never come here. Only group data and per-order summaries the
-- tank owner approved (before / after / delta / calibration snapshot).

begin;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.nivel_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- The one named person who handles orders and discrepancies.
  coordinator_member_id uuid,
  delivery_mode text not null check (delivery_mode in ('cistern', 'tinacos')),
  invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.nivel_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.nivel_groups (id) on delete cascade,
  -- Null for offline members (no phone or no Google account), added by the coordinator.
  user_id uuid references auth.users (id),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  is_offline boolean not null default false,
  added_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (group_id, user_id),
  unique (id, group_id),
  check (is_offline = (user_id is null))
);

-- The coordinator must be a member of the same group.
alter table public.nivel_groups
  add constraint nivel_groups_coordinator_fk
  foreign key (coordinator_member_id, id)
  references public.nivel_group_members (id, group_id)
  deferrable initially deferred;

create table public.nivel_orders (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.nivel_groups (id) on delete cascade,
  supplier_label text not null check (char_length(btrim(supplier_label)) between 1 and 60),
  quoted_liters integer not null check (quoted_liters between 1 and 20000),
  quoted_price_mxn numeric(10, 2) not null check (quoted_price_mxn between 0 and 50000),
  status text not null default 'open' check (status in ('open', 'delivered', 'closed')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.nivel_order_shares (
  order_id uuid not null references public.nivel_orders (id) on delete cascade,
  member_id uuid not null references public.nivel_group_members (id) on delete cascade,
  requested_liters integer not null check (requested_liters between 1 and 20000),
  share_mxn numeric(10, 2) not null default 0 check (share_mxn between 0 and 50000),
  -- Logged only. Nivel never moves money, and "pending" never blocks anything.
  payment_method text not null default 'pending'
    check (payment_method in ('cash', 'transfer', 'pending')),
  recorded_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (order_id, member_id)
);

create table public.nivel_deliveries (
  order_id uuid primary key references public.nivel_orders (id) on delete cascade,
  delivered_at timestamptz not null,
  fill_minutes integer not null check (fill_minutes between 0 and 1440),
  quoted_liters integer not null check (quoted_liters between 1 and 20000),
  observed_liters numeric(10, 1) check (observed_liters between 0 and 200000),
  observed_tanks_reported integer not null default 0 check (observed_tanks_reported >= 0),
  observed_tanks_total integer not null default 0 check (observed_tanks_total >= 0),
  estimated_liters numeric(10, 1) check (estimated_liters between 0 and 200000),
  notes text check (char_length(notes) <= 500),
  recorded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (observed_tanks_reported <= observed_tanks_total)
);

create table public.nivel_tank_summaries (
  order_id uuid not null references public.nivel_orders (id) on delete cascade,
  member_id uuid not null references public.nivel_group_members (id) on delete cascade,
  tank_type text not null check (tank_type in ('tinaco', 'cisterna')),
  before_l numeric(10, 1) not null check (before_l between 0 and 20000),
  after_l numeric(10, 1) not null check (after_l between 0 and 20000),
  delta_l numeric(10, 1) not null check (delta_l between -20000 and 20000),
  -- Exactly these four keys: no room to smuggle a time series in.
  calibration_snapshot jsonb not null check (
    jsonb_typeof(calibration_snapshot) = 'object'
    and calibration_snapshot ?& array['capacity_l', 'd_full_cm', 'd_empty_cm', 'calibrated_at']
    and calibration_snapshot - array['capacity_l', 'd_full_cm', 'd_empty_cm', 'calibrated_at'] = '{}'::jsonb
  ),
  concurrent_use_note text check (char_length(concurrent_use_note) <= 200),
  approved_at timestamptz not null default now(),
  primary key (order_id, member_id),
  check (delta_l = after_l - before_l)
);

create table public.nivel_discrepancies (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.nivel_orders (id) on delete cascade,
  raised_by uuid not null default auth.uid() references auth.users (id),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution_note text check (char_length(resolution_note) <= 500),
  handled_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index nivel_group_members_user_idx on public.nivel_group_members (user_id);
create index nivel_orders_group_idx on public.nivel_orders (group_id);
create index nivel_order_shares_member_idx on public.nivel_order_shares (member_id);
create index nivel_tank_summaries_member_idx on public.nivel_tank_summaries (member_id);
create index nivel_discrepancies_order_idx on public.nivel_discrepancies (order_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create function public.nivel_is_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.nivel_group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create function public.nivel_is_coordinator(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.nivel_groups g
    join public.nivel_group_members m on m.id = g.coordinator_member_id
    where g.id = p_group_id and m.user_id = auth.uid()
  );
$$;

create function public.nivel_order_group(p_order_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select group_id from public.nivel_orders where id = p_order_id;
$$;

-- The member row for the signed-in user, but only if it belongs to the order's group.
create function public.nivel_is_my_member_in_order(p_member_id uuid, p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.nivel_group_members m
    join public.nivel_orders o on o.group_id = m.group_id
    where m.id = p_member_id and o.id = p_order_id and m.user_id = auth.uid()
  );
$$;

-- An offline member of the order's group, and the caller is that group's coordinator.
create function public.nivel_coordinator_for_offline(p_member_id uuid, p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.nivel_group_members m
    join public.nivel_orders o on o.group_id = m.group_id
    where m.id = p_member_id and o.id = p_order_id and m.is_offline
  ) and public.nivel_is_coordinator(public.nivel_order_group(p_order_id));
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Creates a group with the caller as its member and named coordinator.
create function public.nivel_create_group(p_name text, p_display_name text, p_delivery_mode text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
  v_member uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.nivel_groups (name, delivery_mode, created_by)
  values (btrim(p_name), p_delivery_mode, auth.uid())
  returning id into v_group;
  insert into public.nivel_group_members (group_id, user_id, display_name, is_offline, added_by)
  values (v_group, auth.uid(), btrim(p_display_name), false, auth.uid())
  returning id into v_member;
  update public.nivel_groups set coordinator_member_id = v_member where id = v_group;
  return v_group;
end;
$$;

-- Joins a group from its invite link. Idempotent: returns the group if already a member.
create function public.nivel_join_group(p_invite_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select id into v_group from public.nivel_groups where invite_code = p_invite_code;
  if v_group is null then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  insert into public.nivel_group_members (group_id, user_id, display_name, is_offline, added_by)
  values (v_group, auth.uid(), btrim(p_display_name), false, auth.uid())
  on conflict (group_id, user_id) do nothing;
  return v_group;
end;
$$;

-- "Recolectado $X de $Y": totals only, never per-person rows. Members of the group only.
create function public.nivel_order_totals(p_order_id uuid)
returns table (collected_mxn numeric, total_mxn numeric, requested_liters bigint, shares integer)
language sql stable security definer set search_path = '' as $$
  select
    coalesce(sum(s.share_mxn) filter (where s.payment_method <> 'pending'), 0),
    o.quoted_price_mxn,
    coalesce(sum(s.requested_liters), 0),
    count(s.member_id)::integer
  from public.nivel_orders o
  left join public.nivel_order_shares s on s.order_id = o.id
  where o.id = p_order_id and public.nivel_is_member(o.group_id)
  group by o.id, o.quoted_price_mxn;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.nivel_touch_share()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.recorded_by := auth.uid();
  return new;
end;
$$;

create trigger nivel_order_shares_touch
  before insert or update on public.nivel_order_shares
  for each row execute function public.nivel_touch_share();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.nivel_groups enable row level security;
alter table public.nivel_group_members enable row level security;
alter table public.nivel_orders enable row level security;
alter table public.nivel_order_shares enable row level security;
alter table public.nivel_deliveries enable row level security;
alter table public.nivel_tank_summaries enable row level security;
alter table public.nivel_discrepancies enable row level security;

-- groups: members read; coordinator renames / changes delivery mode. Created via RPC only.
create policy nivel_groups_select on public.nivel_groups
  for select to authenticated using (public.nivel_is_member(id));
create policy nivel_groups_update on public.nivel_groups
  for update to authenticated
  using (public.nivel_is_coordinator(id)) with check (public.nivel_is_coordinator(id));

-- members: group reads the member list (names only — no payment data lives here).
create policy nivel_members_select on public.nivel_group_members
  for select to authenticated using (public.nivel_is_member(group_id));
-- Coordinator adds offline members.
create policy nivel_members_insert_offline on public.nivel_group_members
  for insert to authenticated
  with check (
    public.nivel_is_coordinator(group_id)
    and is_offline and user_id is null and added_by = auth.uid()
  );
-- A member renames themself; the coordinator renames offline members.
create policy nivel_members_update on public.nivel_group_members
  for update to authenticated
  using (user_id = auth.uid() or (is_offline and public.nivel_is_coordinator(group_id)))
  with check (user_id = auth.uid() or (is_offline and public.nivel_is_coordinator(group_id)));

-- orders: members read; coordinator opens and updates.
create policy nivel_orders_select on public.nivel_orders
  for select to authenticated using (public.nivel_is_member(group_id));
create policy nivel_orders_insert on public.nivel_orders
  for insert to authenticated
  with check (public.nivel_is_coordinator(group_id) and created_by = auth.uid() and status = 'open');
create policy nivel_orders_update on public.nivel_orders
  for update to authenticated
  using (public.nivel_is_coordinator(group_id)) with check (public.nivel_is_coordinator(group_id));

-- shares: a payment row is readable only by its member and the coordinator.
create policy nivel_shares_select on public.nivel_order_shares
  for select to authenticated
  using (
    public.nivel_is_my_member_in_order(member_id, order_id)
    or public.nivel_is_coordinator(public.nivel_order_group(order_id))
  );
-- Members write their own row; the coordinator writes rows for offline members only.
create policy nivel_shares_insert on public.nivel_order_shares
  for insert to authenticated
  with check (
    public.nivel_is_my_member_in_order(member_id, order_id)
    or public.nivel_coordinator_for_offline(member_id, order_id)
  );
create policy nivel_shares_update on public.nivel_order_shares
  for update to authenticated
  using (
    public.nivel_is_my_member_in_order(member_id, order_id)
    or public.nivel_coordinator_for_offline(member_id, order_id)
  )
  with check (
    public.nivel_is_my_member_in_order(member_id, order_id)
    or public.nivel_coordinator_for_offline(member_id, order_id)
  );

-- deliveries: members read; coordinator records.
create policy nivel_deliveries_select on public.nivel_deliveries
  for select to authenticated using (public.nivel_is_member(public.nivel_order_group(order_id)));
create policy nivel_deliveries_insert on public.nivel_deliveries
  for insert to authenticated
  with check (
    public.nivel_is_coordinator(public.nivel_order_group(order_id)) and recorded_by = auth.uid()
  );
create policy nivel_deliveries_update on public.nivel_deliveries
  for update to authenticated
  using (public.nivel_is_coordinator(public.nivel_order_group(order_id)))
  with check (public.nivel_is_coordinator(public.nivel_order_group(order_id)));

-- tank summaries: the group reads approved summaries; only the tank owner inserts theirs.
create policy nivel_summaries_select on public.nivel_tank_summaries
  for select to authenticated using (public.nivel_is_member(public.nivel_order_group(order_id)));
create policy nivel_summaries_insert on public.nivel_tank_summaries
  for insert to authenticated
  with check (public.nivel_is_my_member_in_order(member_id, order_id));

-- discrepancies: visible to the coordinator and whoever raised it; any member raises;
-- only the coordinator resolves. No delete policy: they can't be deleted.
create policy nivel_discrepancies_select on public.nivel_discrepancies
  for select to authenticated
  using (
    raised_by = auth.uid()
    or public.nivel_is_coordinator(public.nivel_order_group(order_id))
  );
create policy nivel_discrepancies_insert on public.nivel_discrepancies
  for insert to authenticated
  with check (
    raised_by = auth.uid()
    and status = 'open'
    and resolution_note is null
    and handled_by is null
    and public.nivel_is_member(public.nivel_order_group(order_id))
  );
create policy nivel_discrepancies_update on public.nivel_discrepancies
  for update to authenticated
  using (public.nivel_is_coordinator(public.nivel_order_group(order_id)))
  with check (public.nivel_is_coordinator(public.nivel_order_group(order_id)));

-- ---------------------------------------------------------------------------
-- Grants: nothing for anon; authenticated gets only what the policies need,
-- with column-level limits on updates.
-- ---------------------------------------------------------------------------

revoke all on
  public.nivel_groups, public.nivel_group_members, public.nivel_orders,
  public.nivel_order_shares, public.nivel_deliveries, public.nivel_tank_summaries,
  public.nivel_discrepancies
from anon, authenticated;

grant select on
  public.nivel_groups, public.nivel_group_members, public.nivel_orders,
  public.nivel_order_shares, public.nivel_deliveries, public.nivel_tank_summaries,
  public.nivel_discrepancies
to authenticated;

grant update (name, delivery_mode) on public.nivel_groups to authenticated;

grant insert (group_id, user_id, display_name, is_offline, added_by)
  on public.nivel_group_members to authenticated;
grant update (display_name) on public.nivel_group_members to authenticated;

grant insert (group_id, supplier_label, quoted_liters, quoted_price_mxn, status, created_by)
  on public.nivel_orders to authenticated;
grant update (supplier_label, quoted_liters, quoted_price_mxn, status)
  on public.nivel_orders to authenticated;

grant insert (order_id, member_id, requested_liters, share_mxn, payment_method)
  on public.nivel_order_shares to authenticated;
grant update (requested_liters, share_mxn, payment_method)
  on public.nivel_order_shares to authenticated;

grant insert on public.nivel_deliveries to authenticated;
grant update (
  delivered_at, fill_minutes, quoted_liters, observed_liters,
  observed_tanks_reported, observed_tanks_total, estimated_liters, notes
) on public.nivel_deliveries to authenticated;

grant insert on public.nivel_tank_summaries to authenticated;

grant insert (order_id, raised_by, description, status, resolution_note, handled_by)
  on public.nivel_discrepancies to authenticated;
grant update (status, resolution_note, handled_by, resolved_at)
  on public.nivel_discrepancies to authenticated;

revoke all on function
  public.nivel_is_member(uuid), public.nivel_is_coordinator(uuid),
  public.nivel_order_group(uuid), public.nivel_is_my_member_in_order(uuid, uuid),
  public.nivel_coordinator_for_offline(uuid, uuid),
  public.nivel_create_group(text, text, text), public.nivel_join_group(text, text),
  public.nivel_order_totals(uuid), public.nivel_touch_share()
from public, anon;

grant execute on function
  public.nivel_is_member(uuid), public.nivel_is_coordinator(uuid),
  public.nivel_order_group(uuid), public.nivel_is_my_member_in_order(uuid, uuid),
  public.nivel_coordinator_for_offline(uuid, uuid),
  public.nivel_create_group(text, text, text), public.nivel_join_group(text, text),
  public.nivel_order_totals(uuid)
to authenticated;

commit;
