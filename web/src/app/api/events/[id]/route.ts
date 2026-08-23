import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const FIELDS =
  "id, name, starts_at, ends_at, max_capacity, multi_entry, capture_geo, " +
  "location_name, location_address, location_city, location_lat, location_lng, " +
  "send_mode, created_at, event_operators(operator_email)";

/** GET /api/events/[id] — un evento con sus operadores. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin().from("events").select(FIELDS).eq("id", params.id).single();
  if (error) return Response.json({ error: error.message }, { status: 404 });
  return Response.json(data);
}

/** PATCH /api/events/[id] — edita el evento y reemplaza sus operadores. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Cuerpo inválido" }, { status: 400 });

  const db = supabaseAdmin();
  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim();
  if ("starts_at" in b) patch.starts_at = b.starts_at || null;
  if ("ends_at" in b) patch.ends_at = b.ends_at || null;
  if ("max_capacity" in b) patch.max_capacity = Number.isFinite(b.max_capacity) ? b.max_capacity : null;
  if ("multi_entry" in b) patch.multi_entry = Boolean(b.multi_entry);
  if ("capture_geo" in b) patch.capture_geo = Boolean(b.capture_geo);
  if ("location_name" in b) patch.location_name = b.location_name || null;
  if ("location_address" in b) patch.location_address = b.location_address || null;
  if ("location_city" in b) patch.location_city = b.location_city || null;
  if (b.send_mode === "immediate" || b.send_mode === "deferred") patch.send_mode = b.send_mode;

  if (Object.keys(patch).length > 0) {
    const { error } = await db.from("events").update(patch).eq("id", params.id);
    if (error) return Response.json({ error: error.message }, { status: 502 });
  }

  // Reemplaza operadores si vienen en el body.
  if (Array.isArray(b.operators)) {
    const emails: string[] = b.operators.filter((e: unknown): e is string => typeof e === "string");
    await db.from("event_operators").delete().eq("event_id", params.id);
    if (emails.length > 0) {
      const { error } = await db
        .from("event_operators")
        .insert(emails.map((operator_email) => ({ event_id: params.id, operator_email })));
      if (error) return Response.json({ error: error.message }, { status: 502 });
    }
  }

  return Response.json({ ok: true });
}
