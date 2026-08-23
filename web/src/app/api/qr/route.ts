import QRCode from "qrcode";
import { verifyTicketToken } from "@/lib/token";

export const dynamic = "force-dynamic";

/**
 * GET /api/qr?t=<token>
 * Devuelve el PNG del código QR para un token firmado válido.
 * Se usa como imagen por URL en el correo (más compatible que cid: inline).
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!token || !verifyTicketToken(token)) {
    return new Response("QR no válido", { status: 404 });
  }
  const png = await QRCode.toBuffer(token, { width: 480, margin: 2 });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
