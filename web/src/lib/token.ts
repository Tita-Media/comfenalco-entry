import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.QR_TOKEN_SECRET;
  if (!s) throw new Error("QR_TOKEN_SECRET no configurado");
  return s;
}

/**
 * El QR contiene `<ticketId>.<firma>`: un id no adivinable más una firma HMAC.
 * Un token inventado se descarta sin tocar la base de datos.
 */
export function signTicketToken(ticketId: string): string {
  const sig = createHmac("sha256", secret())
    .update(ticketId)
    .digest("base64url")
    .slice(0, 22);
  return `${ticketId}.${sig}`;
}

export function verifyTicketToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  let expected: string;
  try {
    expected = signTicketToken(id);
  } catch {
    return null;
  }
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}
