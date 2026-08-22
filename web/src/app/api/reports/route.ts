import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports?event_id=?
 * Datos para el tablero de reportes: entradas (con hora y geo) + totales.
 */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const eventId = new URL(req.url).searchParams.get("event_id");
  const db = supabaseAdmin();

  let q = db
    .from("entries")
    .select("scanned_at, lat, lng, operator, event_id, events(name)")
    .order("scanned_at", { ascending: false })
    .limit(5000);
  if (eventId) q = q.eq("event_id", eventId);

  const [entriesRes, eventsRes] = await Promise.all([
    q,
    db.from("events").select("id, name").order("created_at", { ascending: false }),
  ]);

  if (entriesRes.error) return Response.json({ error: entriesRes.error.message }, { status: 502 });

  return Response.json({
    entries: entriesRes.data ?? [],
    events: eventsRes.data ?? [],
  });
}
