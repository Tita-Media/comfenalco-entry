import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** GET /api/tickets?event_id=... — grilla del backoffice */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const eventId = new URL(req.url).searchParams.get("event_id");
  if (!eventId) return Response.json({ error: "event_id requerido" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("tickets")
    .select(
      "id, attendee_name, attendee_email, attendee_doc, token, status, email_sent_at, redeemed_at, redeemed_by, created_at"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data);
}
