import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id, name, event_date, send_mode, created_at, tickets(count)")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data);
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "Nombre requerido" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("events")
    .insert({
      name,
      event_date: body?.event_date || null,
      send_mode: body?.send_mode === "immediate" ? "immediate" : "deferred",
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data, { status: 201 });
}
