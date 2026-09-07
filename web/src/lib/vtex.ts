// Cliente mínimo de la API OMS de VTEX para leer órdenes pagadas.
// Requiere VTEX_ACCOUNT, VTEX_APP_KEY, VTEX_APP_TOKEN (variables de entorno).
// NOTA: rutas y campos de OMS pueden variar por versión de la cuenta;
// confirmar contra la cuenta de Comfenalco antes de producción.

const ACCOUNT = process.env.VTEX_ACCOUNT;
const ENVIRONMENT = process.env.VTEX_ENVIRONMENT ?? "vtexcommercestable";
const APP_KEY = process.env.VTEX_APP_KEY;
const APP_TOKEN = process.env.VTEX_APP_TOKEN;

// Estados que indican que la orden está pagada (una orden pagada avanza por
// varios de estos; deduplicamos por orderId y, más abajo, por external_ref).
const PAID_STATUSES = ["payment-approved", "ready-for-handling", "handling", "invoiced"];

export function vtexConfigured(): boolean {
  return Boolean(ACCOUNT && APP_KEY && APP_TOKEN);
}

const base = () => `https://${ACCOUNT}.${ENVIRONMENT}.com.br`;
const headers = () => ({
  "X-VTEX-API-AppKey": APP_KEY!,
  "X-VTEX-API-AppToken": APP_TOKEN!,
  "Content-Type": "application/json",
  Accept: "application/json",
});

export type VtexOrderRef = { orderId: string; status: string };

/** Lista órdenes pagadas creadas desde `sinceISO`. */
export async function listPaidOrders(sinceISO: string): Promise<VtexOrderRef[]> {
  const out: VtexOrderRef[] = [];
  const seen = new Set<string>();
  for (const status of PAID_STATUSES) {
    const q = new URLSearchParams({
      f_status: status,
      f_creationDate: `creationDate:[${sinceISO} TO *]`,
      orderBy: "creationDate,desc",
      per_page: "100",
    });
    const res = await fetch(`${base()}/api/oms/pvt/orders?${q}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) continue;
    const j = (await res.json()) as { list?: { orderId: string; status: string }[] };
    for (const o of j.list ?? []) {
      if (!seen.has(o.orderId)) {
        seen.add(o.orderId);
        out.push({ orderId: o.orderId, status: o.status });
      }
    }
  }
  return out;
}

export type VtexOrder = {
  orderId: string;
  clientProfileData?: { firstName?: string; lastName?: string; email?: string; document?: string };
  items?: { id?: string; refId?: string; sellerSku?: string; name?: string; quantity?: number }[];
  customData?: { customApps?: { id?: string; fields?: Record<string, string> }[] };
};

export type Attendee = { name?: string; doc?: string | null; email?: string | null };

// Config del grupo de campos donde el checkout de reservas guarda los asistentes.
const RESERVA_APP_ID = process.env.VTEX_RESERVA_APP_ID; // p. ej. "reservas" (opcional: si vacío, escanea todas)
const RESERVA_FIELD = process.env.VTEX_RESERVA_FIELD; // p. ej. "asistentes" (opcional)

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = o[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return undefined;
};

/**
 * Extrae los asistentes de customData (arreglo JSON en un campo de customApps).
 * Tolerante a nombres de campo en español/inglés. Vacío si no hay.
 */
export function extractAttendees(order: VtexOrder): Attendee[] {
  const apps = order.customData?.customApps ?? [];
  for (const app of apps) {
    if (RESERVA_APP_ID && app.id !== RESERVA_APP_ID) continue;
    const fields = app.fields ?? {};
    const candidates = RESERVA_FIELD ? [fields[RESERVA_FIELD]] : Object.values(fields);
    for (const raw of candidates) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
          return (parsed as Record<string, unknown>[]).map((a) => ({
            name: pick(a, ["name", "nombre", "fullName", "nombreCompleto"]),
            doc: pick(a, ["doc", "document", "documento", "cedula", "identification", "id"]) ?? null,
            email: pick(a, ["email", "correo", "mail"]) ?? null,
          }));
        }
      } catch {
        // el campo no era JSON; seguir buscando
      }
    }
  }
  return [];
}

/** Detalle de una orden. */
export async function getOrder(orderId: string): Promise<VtexOrder | null> {
  const res = await fetch(`${base()}/api/oms/pvt/orders/${orderId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as VtexOrder;
}
