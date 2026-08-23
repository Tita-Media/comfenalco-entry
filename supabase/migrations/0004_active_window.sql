-- 0004: un evento solo se puede escanear dentro de su ventana [starts_at, ends_at].
-- Fechas nulas = sin restricción (siempre activo). Añade el resultado 'inactive'.

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

  -- Ventana de actividad del evento.
  if ev.starts_at is not null and now() < ev.starts_at then
    return jsonb_build_object('result','inactive','reason','not_started',
      'attendee_name',t.attendee_name,'event_name',ev.name,'starts_at',ev.starts_at);
  end if;
  if ev.ends_at is not null and now() > ev.ends_at then
    return jsonb_build_object('result','inactive','reason','ended',
      'attendee_name',t.attendee_name,'event_name',ev.name,'ends_at',ev.ends_at);
  end if;

  if t.status = 'pending' then
    return jsonb_build_object('result', 'not_issued');
  end if;

  if ev.multi_entry then
    insert into entries(ticket_id, event_id, operator, lat, lng, accuracy)
      values (t.id, t.event_id, p_operator, p_lat, p_lng, p_accuracy);
    select count(*) into entry_no from entries where ticket_id = t.id;
    if t.status = 'issued' then
      update tickets set status='redeemed', redeemed_at=now(), redeemed_by=p_operator where id=t.id;
    end if;
    return jsonb_build_object('result','ok','multi',true,'entry_number',entry_no,
      'attendee_name',t.attendee_name,'attendee_doc',t.attendee_doc);
  end if;

  if t.status = 'redeemed' then
    return jsonb_build_object('result','already_used','attendee_name',t.attendee_name,
      'redeemed_at',t.redeemed_at,'redeemed_by',t.redeemed_by);
  end if;

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
    return jsonb_build_object('result','ok','attendee_name',t.attendee_name,'attendee_doc',t.attendee_doc);
  else
    select * into t from tickets where id = p_ticket_id;
    return jsonb_build_object('result','already_used','attendee_name',t.attendee_name,
      'redeemed_at',t.redeemed_at,'redeemed_by',t.redeemed_by);
  end if;
end;
$$;

revoke all on function redeem_ticket(uuid, text, double precision, double precision, double precision)
  from public, anon, authenticated;
