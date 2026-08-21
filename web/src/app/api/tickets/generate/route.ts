import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";
import { signTicketToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * POST /api/tickets/generate { event_id }
 * Generación batch: firma un token por cada boleta pendiente y la pasa a "issued".
 */
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const eventId = body?.event_id;
  if (!eventId) return Response.json({ error: "event_id requerido" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: pending, error } = await db
    .from("tickets")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "pending");

  if (error) return Response.json({ error: error.message }, { status: 502 });
  if (!pending || pending.length === 0) return Response.json({ generated: 0 });

  let generated = 0;
  for (const t of pending) {
    const { error: upErr } = await db
      .from("tickets")
      .update({ token: signTicketToken(t.id), status: "issued" })
      .eq("id", t.id)
      .eq("status", "pending");
    if (!upErr) generated++;
  }

  return Response.json({ generated });
}
