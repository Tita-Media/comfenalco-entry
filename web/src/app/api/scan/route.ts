import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";
import { verifyTicketToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * POST /api/scan { token }
 * Verifica la firma del token y redime la boleta de forma atómica.
 * Respuestas: ok | already_used | invalid | not_issued
 */
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const token: unknown = body?.token;
  if (typeof token !== "string" || token.length > 200) {
    return Response.json({ result: "invalid" }, { status: 400 });
  }

  const ticketId = verifyTicketToken(token);
  if (!ticketId) {
    return Response.json({ result: "invalid" });
  }

  const operator = user.email ?? user.id;
  const { data, error } = await supabaseAdmin().rpc("redeem_ticket", {
    p_ticket_id: ticketId,
    p_operator: operator,
  });

  if (error) {
    console.error("redeem_ticket falló:", error.message);
    return Response.json({ error: "Error del sistema, reintentar" }, { status: 502 });
  }

  return Response.json(data);
}
