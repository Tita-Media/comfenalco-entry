import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// NOTA: en el piloto todo usuario autenticado es personal de confianza y puede
// gestionar operadores. Si más adelante se requiere separar admin/operador,
// añadir un rol y validarlo aquí.

/** GET /api/operators — lista de operadores (usuarios de Supabase Auth). */
export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin().auth.admin.listUsers({ perPage: 200 });
  if (error) return Response.json({ error: error.message }, { status: 502 });

  const operators = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    disabled: Boolean((u as { banned_until?: string }).banned_until),
  }));
  return Response.json(operators);
}

/** POST /api/operators { email, password } — crea un operador. */
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email.includes("@") || password.length < 8) {
    return Response.json({ error: "Email válido y contraseña de 8+ caracteres" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ id: data.user.id, email: data.user.email }, { status: 201 });
}

/** DELETE /api/operators?id=... — elimina un operador. */
export async function DELETE(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });
  if (id === user.id) return Response.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 });

  const { error } = await supabaseAdmin().auth.admin.deleteUser(id);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ ok: true });
}
