-- 0003: opciones de evento, entradas con geolocalización,
-- operadores por evento y redención con multi-ingreso + capacidad.

-- ── Opciones de evento ─────────────────────────────────────────────
alter table events
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists max_capacity int,
  add column if not exists multi_entry boolean not null default false,
  add column if not exists capture_geo boolean not null default false,
  add column if not exists location_name text,
  add column if not exists location_address text,
  add column if not exists location_city text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;

-- Backfill del inicio desde el event_date existente
update events set starts_at = event_date::timestamptz
  where starts_at is null and event_date is not null;

-- ── Entradas (cada ingreso exitoso; soporta multi-ingreso y geo) ────
create table if not exists entries (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  operator text,
  scanned_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  accuracy double precision
);
create index if not exists entries_event_idx on entries(event_id);
create index if not exists entries_ticket_idx on entries(ticket_id);

-- ── Operadores habilitados por evento ──────────────────────────────
create table if not exists event_operators (
  event_id uuid not null references events(id) on delete cascade,
  operator_email text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, operator_email)
);

alter table entries enable row level security;
alter table event_operators enable row level security;

-- Lectura para operadores autenticados (reportes / realtime); escritura solo service role.
drop policy if exists "operadores leen entries" on entries;
create policy "operadores leen entries" on entries for select to authenticated using (true);
drop policy if exists "operadores leen event_operators" on event_operators;
create policy "operadores leen event_operators" on event_operators for select to authenticated using (true);

-- Realtime de entries (backoffice/reportes en vivo)
alter table entries replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='entries'
  ) then
    alter publication supabase_realtime add table entries;
  end if;
end $$;

-- ── Redención: geo + multi-ingreso + capacidad ─────────────────────
-- Se elimina la versión anterior (2 args) para evitar ambigüedad de overload.
drop function if exists redeem_ticket(uuid, text);

create or replace function redeem_ticket(
  p_ticket_id uuid,
  p_operator text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t tickets%rowtype;
  ev events%rowtype;
  admitted int;
  entry_no int;
begin
  select * into t from tickets where id = p_ticket_id;
  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;

  select * into ev from events where id = t.event_id;

  if t.status = 'pending' then
    return jsonb_build_object('result', 'not_issued');
  end if;

  -- Multi-ingreso: registrar cada entrada, sin bloquear el reingreso.
  if ev.multi_entry then
    insert into entries(ticket_id, event_id, operator, lat, lng, accuracy)
      values (t.id, t.event_id, p_operator, p_lat, p_lng, p_accuracy);
    select count(*) into entry_no from entries where ticket_id = t.id;
    if t.status = 'issued' then
      update tickets set status='redeemed', redeemed_at=now(), redeemed_by=p_operator where id=t.id;
    end if;
    return jsonb_build_object(
      'result','ok','multi',true,'entry_number',entry_no,
      'attendee_name',t.attendee_name,'attendee_doc',t.attendee_doc
    );
  end if;

  -- Un solo ingreso.
  if t.status = 'redeemed' then
    return jsonb_build_object(
      'result','already_used','attendee_name',t.attendee_name,
      'redeemed_at',t.redeemed_at,'redeemed_by',t.redeemed_by
    );
  end if;

  -- Capacidad máxima (cuenta ingresos únicos = boletas redimidas).
  if ev.max_capacity is not null then
    select count(*) into admitted from tickets where event_id=t.event_id and status='redeemed';
    if admitted >= ev.max_capacity then
      return jsonb_build_object('result','full','attendee_name',t.attendee_name);
    end if;
  end if;

  update tickets set status='redeemed', redeemed_at=now(), redeemed_by=p_operator
    where id=t.id and status='issued'
    returning * into t;

  if found then
    insert into entries(ticket_id, event_id, operator, lat, lng, accuracy)
      values (t.id, t.event_id, p_operator, p_lat, p_lng, p_accuracy);
    return jsonb_build_object(
      'result','ok','attendee_name',t.attendee_name,'attendee_doc',t.attendee_doc
    );
  else
    select * into t from tickets where id = p_ticket_id;
    return jsonb_build_object(
      'result','already_used','attendee_name',t.attendee_name,
      'redeemed_at',t.redeemed_at,'redeemed_by',t.redeemed_by
    );
  end if;
end;
$$;

revoke all on function redeem_ticket(uuid, text, double precision, double precision, double precision)
  from public, anon, authenticated;
