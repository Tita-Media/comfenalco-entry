import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/active
 * Eventos escaneables ahora: dentro de su ventana [starts_at, ends_at]
 * (fechas nulas = sin restricción). Lo consume la app para saber qué está activo.
 */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, name, starts_at, ends_at, location_name, location_city")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("starts_at", { ascending: true, nullsFirst: false });

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data);
}
