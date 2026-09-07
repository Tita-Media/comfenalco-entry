-- 0005: integración con VTEX — origen de la boleta, idempotencia y mapeo SKU→evento.

-- Origen y referencia externa (para no duplicar boletas al reprocesar órdenes).
alter table tickets
  add column if not exists source text not null default 'manual',
  add column if not exists external_ref text;

create unique index if not exists tickets_external_ref_key
  on tickets (external_ref) where external_ref is not null;

-- Qué SKU/producto de VTEX corresponde a qué evento.
create table if not exists vtex_product_map (
  sku text primary key,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table vtex_product_map enable row level security;
drop policy if exists "operadores leen vtex_map" on vtex_product_map;
create policy "operadores leen vtex_map"
  on vtex_product_map for select to authenticated using (true);
