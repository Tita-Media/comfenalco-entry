import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/tickets/search?doc=... | ?q=...
 * Busca boletas por documento (cédula) o nombre, para reenviar el QR en puerta.
 */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const url = new URL(req.url);
  const q = (url.searchParams.get("doc") ?? url.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return Response.json({ error: "Escribe al menos 3 caracteres" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("tickets")
    .select(
      "id, event_id, attendee_name, attendee_email, attendee_doc, status, redeemed_at, redeemed_by, events(name, multi_entry), entries(count)"
    )
    .or(`attendee_doc.ilike.%${q}%,attendee_name.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data);
}
