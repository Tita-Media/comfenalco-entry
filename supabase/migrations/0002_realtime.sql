-- Realtime: reflejar el check-in en vivo en el backoffice.
-- Cuando la app redime una boleta (UPDATE a 'redeemed'), Supabase emite el
-- cambio a los clientes suscritos y la grilla se actualiza sola.

-- Entregar el registro completo en los eventos de UPDATE/DELETE (para filtros).
alter table tickets replica identity full;

-- Agregar la tabla a la publicación de realtime (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table tickets;
  end if;
end $$;

-- Realtime evalúa RLS con el rol del suscriptor. El backoffice se suscribe como
-- operador autenticado (Supabase Auth), así que necesita permiso de SELECT.
-- La escritura sigue siendo exclusiva del backend (service role); esto solo
-- habilita lectura/suscripción a usuarios logueados (personal de confianza).
drop policy if exists "operadores leen tickets" on tickets;
create policy "operadores leen tickets"
  on tickets for select
  to authenticated
  using (true);
