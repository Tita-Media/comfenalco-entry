import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { vtexConfigured, listPaidOrders, getOrder } from "@/lib/vtex";
import { signTicketToken } from "@/lib/token";
import { sendTicketEmail, smtpConfigured } from "@/lib/mailer";

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

  let created = 0;
  let sent = 0;
  const failures: string[] = [];

  for (const { orderId } of orders) {
    const order = await getOrder(orderId);
    if (!order) continue;
    const c = order.clientProfileData ?? {};
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Asistente";
    const email = (c.email ?? "").trim().toLowerCase();
    const doc = c.document ?? null;
    if (!email) continue;

    for (const item of order.items ?? []) {
      const sku = String(item.sellerSku ?? item.refId ?? item.id ?? "");
      const eventId = skuToEvent.get(sku);
      if (!eventId) continue;
      const ev = events.get(eventId);
      const qty = Math.max(1, item.quantity ?? 1);

      for (let i = 0; i < qty; i++) {
        const external_ref = `vtex:${orderId}:${item.id ?? sku}:${i}`;
        const { data: ins, error } = await db
          .from("tickets")
          .insert({
            event_id: eventId,
            attendee_name: name,
            attendee_email: email,
            attendee_doc: doc,
            source: "vtex",
            external_ref,
          })
          .select("id")
          .single();

        // Conflicto por external_ref (ya procesado) → idempotente, se ignora.
        if (error || !ins) continue;
        created++;

        // Envío inmediato: emitir token y enviar el QR ya.
        if (ev && ev.send_mode === "immediate") {
          try {
            const token = signTicketToken(ins.id);
            await db.from("tickets").update({ token, status: "issued" }).eq("id", ins.id);
            if (smtpConfigured()) {
              await sendTicketEmail({
                to: email,
                attendeeName: name,
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
              sent++;
            }
          } catch (e) {
            failures.push(external_ref);
            console.error("VTEX sync envío falló:", external_ref, e);
          }
        }
      }
    }
  }

  return Response.json({ orders: orders.length, created, sent, failures });
}
