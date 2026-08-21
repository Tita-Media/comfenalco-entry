import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Row = { name?: unknown; email?: unknown; doc?: unknown };

/**
 * POST /api/tickets/import { event_id, rows: [{ name, email, doc? }] }
 * Carga de reservas. En el piloto reemplaza la ingesta desde el
 * microservicio de reportería; el contrato queda igual para conectarlo después.
 */
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const eventId = body?.event_id;
  const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!eventId || rows.length === 0) {
    return Response.json({ error: "event_id y rows requeridos" }, { status: 400 });
  }
  if (rows.length > 5000) {
    return Response.json({ error: "Máximo 5000 filas por carga" }, { status: 400 });
  }

  const clean = rows
    .map((r) => ({
      event_id: eventId,
      attendee_name: String(r.name ?? "").trim(),
      attendee_email: String(r.email ?? "").trim().toLowerCase(),
      attendee_doc: r.doc ? String(r.doc).trim() : null,
    }))
    .filter((r) => r.attendee_name && r.attendee_email.includes("@"));

  if (clean.length === 0) {
    return Response.json({ error: "Ninguna fila válida (se requiere nombre y email)" }, { status: 400 });
  }

  const { error, count } = await supabaseAdmin()
    .from("tickets")
    .insert(clean, { count: "exact" });

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ inserted: count ?? clean.length, skipped: rows.length - clean.length });
}
