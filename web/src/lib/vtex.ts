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
};

/** Detalle de una orden. */
export async function getOrder(orderId: string): Promise<VtexOrder | null> {
  const res = await fetch(`${base()}/api/oms/pvt/orders/${orderId}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as VtexOrder;
}
