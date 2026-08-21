import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/scan/history
 * Ingresos realizados (boletas redimidas), más recientes primero.
 * Lo consume la app móvil para el listado de ingresos.
 */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin()
    .from("tickets")
    .select("id, attendee_name, attendee_doc, redeemed_at, redeemed_by, events(name)")
    .eq("status", "redeemed")
    .order("redeemed_at", { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data);
}
