-- Tiquetera QR — esquema del piloto
-- Solo el backend (service role) accede a estas tablas; RLS queda activo sin
-- políticas para que la anon key no pueda leer ni escribir nada.

create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  -- immediate: la boleta se envía al crearse; deferred: se envía en batch al cierre
  send_mode text not null default 'deferred' check (send_mode in ('immediate', 'deferred')),
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendee_name text not null,
  attendee_email text not null,
  attendee_doc text,
  token text unique,
  status text not null default 'pending' check (status in ('pending', 'issued', 'redeemed')),
  email_sent_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by text,
  created_at timestamptz not null default now()
);

create index if not exists tickets_event_idx on tickets (event_id);
create index if not exists tickets_token_idx on tickets (token);

create table if not exists scan_logs (
  id bigint generated always as identity primary key,
  ticket_id uuid references tickets(id) on delete set null,
  result text not null,
  operator text,
  scanned_at timestamptz not null default now()
);

alter table events enable row level security;
alter table tickets enable row level security;
alter table scan_logs enable row level security;

-- Redención atómica: dos escaneos simultáneos del mismo QR -> solo uno gana.
-- El UPDATE condicionado por status = 'issued' es una sola sentencia, por lo
-- que Postgres garantiza que únicamente una transacción lo materializa.
create or replace function redeem_ticket(p_ticket_id uuid, p_operator text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t tickets%rowtype;
begin
  update tickets
     set status = 'redeemed', redeemed_at = now(), redeemed_by = p_operator
   where id = p_ticket_id and status = 'issued'
   returning * into t;

  if found then
    insert into scan_logs (ticket_id, result, operator) values (t.id, 'ok', p_operator);
    return jsonb_build_object(
      'result', 'ok',
      'attendee_name', t.attendee_name,
      'attendee_doc', t.attendee_doc,
      'redeemed_at', t.redeemed_at
    );
  end if;

  select * into t from tickets where id = p_ticket_id;

  if not found then
    insert into scan_logs (result, operator) values ('invalid', p_operator);
    return jsonb_build_object('result', 'invalid');
  elsif t.status = 'redeemed' then
    insert into scan_logs (ticket_id, result, operator) values (t.id, 'already_used', p_operator);
    return jsonb_build_object(
      'result', 'already_used',
      'attendee_name', t.attendee_name,
      'redeemed_at', t.redeemed_at,
      'redeemed_by', t.redeemed_by
    );
  else
    insert into scan_logs (ticket_id, result, operator) values (t.id, 'not_issued', p_operator);
    return jsonb_build_object('result', 'not_issued');
  end if;
end;
$$;

revoke all on function redeem_ticket(uuid, text) from public, anon, authenticated;
