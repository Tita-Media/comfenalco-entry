import { requireUser, supabaseAdmin, unauthorized } from "@/lib/supabaseAdmin";
import { sendTicketEmail, smtpConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/tickets/send { event_id, ticket_id? }
 * Envía por correo las boletas emitidas y no enviadas del evento
 * (o una sola si viene ticket_id: caso reenvío desde servicio al cliente).
 * Sin SMTP configurado, simula el envío para poder demostrar el flujo.
 */
export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const eventId = body?.event_id;
  if (!eventId) return Response.json({ error: "event_id requerido" }, { status: 400 });

  const db = supabaseAdmin();

  const { data: event, error: evErr } = await db
    .from("events")
    .select("name, event_date")
    .eq("id", eventId)
    .single();
  if (evErr || !event) return Response.json({ error: "Evento no encontrado" }, { status: 404 });

  let query = db
    .from("tickets")
    .select("id, attendee_name, attendee_email, token")
    .eq("event_id", eventId)
    .eq("status", "issued")
    .not("token", "is", null);

  if (body?.ticket_id) {
    query = query.eq("id", body.ticket_id);
  } else {
    query = query.is("email_sent_at", null);
  }

  const { data: tickets, error } = await query.limit(500);
  if (error) return Response.json({ error: error.message }, { status: 502 });
  if (!tickets || tickets.length === 0) return Response.json({ sent: 0, simulated: !smtpConfigured() });

  const simulated = !smtpConfigured();
  let sent = 0;
  const failures: string[] = [];

  for (const t of tickets) {
    try {
      if (!simulated) {
        await sendTicketEmail({
          to: t.attendee_email,
          attendeeName: t.attendee_name,
          eventName: event.name,
          eventDate: event.event_date,
          token: t.token!,
        });
      }
      await db.from("tickets").update({ email_sent_at: new Date().toISOString() }).eq("id", t.id);
      sent++;
    } catch (e) {
      failures.push(t.attendee_email);
      console.error(`Envío falló para ${t.attendee_email}:`, e);
    }
  }

  return Response.json({ sent, simulated, failures });
}
