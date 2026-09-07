import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { vtexConfigured, listPaidOrders, getOrder, extractAttendees, type VtexOrder } from "@/lib/vtex";
import { signTicketToken } from "@/lib/token";
import { sendTicketEmail, smtpConfigured } from "@/lib/mailer";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type EventRow = {
  id: string;
  name: string;
  send_mode: "immediate" | "deferred";
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  location_city: string | null;
  multi_entry: boolean;
};

/**
 * GET /api/vtex/sync
 * Consume las órdenes pagadas de VTEX y crea las boletas de forma idempotente.
 * Si el evento es de envío inmediato, además emite y envía el QR.
 * Se ejecuta por Vercel Cron (protegido con CRON_SECRET).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }
  if (!vtexConfigured()) {
    return Response.json({ skipped: true, reason: "VTEX no configurado" });
  }

  const db = supabaseAdmin();

  // Mapa SKU -> event_id y datos de los eventos referenciados.
  const { data: maps } = await db.from("vtex_product_map").select("sku, event_id");
  const skuToEvent = new Map((maps ?? []).map((m) => [String(m.sku), m.event_id as string]));
  if (skuToEvent.size === 0) {
    return Response.json({ skipped: true, reason: "Sin mapeo SKU→evento (vtex_product_map vacío)" });
  }

  const eventIds = [...new Set(skuToEvent.values())];
  const { data: evs } = await db
    .from("events")
    .select("id, name, send_mode, starts_at, ends_at, location_name, location_address, location_city, multi_entry")
    .in("id", eventIds);
  const events = new Map((evs ?? []).map((e) => [e.id, e as EventRow]));

  const sinceISO = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); // últimas 6 horas
  const orders = await listPaidOrders(sinceISO);

  const stats = { created: 0, sent: 0, failures: [] as string[] };

  for (const { orderId } of orders) {
    const order = await getOrder(orderId);
    if (!order) continue;

    const c = order.clientProfileData ?? {};
    const buyer = {
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Asistente",
      email: (c.email ?? "").trim().toLowerCase(),
      doc: c.document ?? null,
    };

    // Ítems mapeados a un evento.
    const mapped = (order.items ?? [])
      .map((it) => ({ it, eventId: skuToEvent.get(String(it.sellerSku ?? it.refId ?? it.id ?? "")) }))
      .filter((x): x is { it: NonNullable<VtexOrder["items"]>[number]; eventId: string } => Boolean(x.eventId));
    if (mapped.length === 0) continue;

    const distinctEvents = new Set(mapped.map((m) => m.eventId));
    const attendees = extractAttendees(order);

    // Caso multi‑asistente: customData con asistentes + un solo evento en la orden.
    if (attendees.length > 0 && distinctEvents.size === 1) {
      const eventId = mapped[0].eventId;
      const ev = events.get(eventId);
      for (let i = 0; i < attendees.length; i++) {
        const a = attendees[i];
        await issue(
          db,
          eventId,
          ev,
          {
            name: a.name || buyer.name,
            email: (a.email || buyer.email).trim().toLowerCase(),
            doc: a.doc ?? buyer.doc,
          },
          `vtex:${orderId}:att:${i}`,
          stats
        );
      }
    } else {
      // Fallback: datos del comprador × cantidad, por cada ítem mapeado.
      if (!buyer.email) continue;
      for (const { it, eventId } of mapped) {
        const ev = events.get(eventId);
        const qty = Math.max(1, it.quantity ?? 1);
        for (let i = 0; i < qty; i++) {
          await issue(db, eventId, ev, buyer, `vtex:${orderId}:${it.id ?? eventId}:${i}`, stats);
        }
      }
    }
  }

  return Response.json({ orders: orders.length, ...stats });
}

/** Crea una boleta idempotente y, si el evento es inmediato, emite y envía el QR. */
async function issue(
  db: SupabaseClient,
  eventId: string,
  ev: EventRow | undefined,
  person: { name: string; email: string; doc: string | null },
  externalRef: string,
  stats: { created: number; sent: number; failures: string[] }
) {
  if (!person.email) return;
  const { data: ins, error } = await db
    .from("tickets")
    .insert({
      event_id: eventId,
      attendee_name: person.name,
      attendee_email: person.email,
      attendee_doc: person.doc,
      source: "vtex",
      external_ref: externalRef,
    })
    .select("id")
    .single();

  if (error || !ins) return; // conflicto por external_ref → idempotente
  stats.created++;

  if (ev && ev.send_mode === "immediate") {
    try {
      const token = signTicketToken(ins.id);
      await db.from("tickets").update({ token, status: "issued" }).eq("id", ins.id);
      if (smtpConfigured()) {
        await sendTicketEmail({
          to: person.email,
          attendeeName: person.name,
          token,
          event: {
            name: ev.name,
            startsAt: ev.starts_at,
            endsAt: ev.ends_at,
            locationName: ev.location_name,
            locationAddress: ev.location_address,
            locationCity: ev.location_city,
            multiEntry: ev.multi_entry,
          },
        });
        await db.from("tickets").update({ email_sent_at: new Date().toISOString() }).eq("id", ins.id);
        stats.sent++;
      }
    } catch (e) {
      stats.failures.push(externalRef);
      console.error("VTEX sync envío falló:", externalRef, e);
    }
  }
}
