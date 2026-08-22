import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const EVENT_FIELDS =
  "id, name, starts_at, ends_at, max_capacity, multi_entry, capture_geo, " +
  "location_name, location_address, location_city, location_lat, location_lng, " +
  "send_mode, created_at, tickets(count), event_operators(operator_email)";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin()
    .from("events")
    .select(EVENT_FIELDS)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const b = await req.json().catch(() => null);
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  if (!name) return Response.json({ error: "Nombre requerido" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: event, error } = await db
    .from("events")
    .insert({
      name,
      starts_at: b?.starts_at || null,
      ends_at: b?.ends_at || null,
      max_capacity: Number.isFinite(b?.max_capacity) ? b.max_capacity : null,
      multi_entry: Boolean(b?.multi_entry),
      capture_geo: Boolean(b?.capture_geo),
      location_name: b?.location_name || null,
      location_address: b?.location_address || null,
      location_city: b?.location_city || null,
      location_lat: Number.isFinite(b?.location_lat) ? b.location_lat : null,
      location_lng: Number.isFinite(b?.location_lng) ? b.location_lng : null,
      send_mode: b?.send_mode === "immediate" ? "immediate" : "deferred",
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 502 });

  const operators: string[] = Array.isArray(b?.operators)
    ? b.operators.filter((e: unknown): e is string => typeof e === "string")
    : [];
  if (operators.length > 0) {
    const { error: opErr } = await db
      .from("event_operators")
      .insert(operators.map((operator_email) => ({ event_id: event.id, operator_email })));
    if (opErr) return Response.json({ error: opErr.message }, { status: 502 });
  }

  return Response.json(event, { status: 201 });
}
