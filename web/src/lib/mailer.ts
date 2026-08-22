import nodemailer from "nodemailer";
import QRCode from "qrcode";

export type TicketEmail = {
  to: string;
  attendeeName: string;
  token: string;
  event: {
    name: string;
    startsAt: string | null;
    endsAt: string | null;
    locationName: string | null;
    locationAddress: string | null;
    locationCity: string | null;
    multiEntry: boolean;
  };
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comfenalco-entry.vercel.app";
const LOGO_URL = `${SITE_URL}/comfenalco-logo.png`;

/** Sin SMTP configurado el envío se simula: útil para la demo sin credenciales. */
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function fmtRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt) return "";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/Bogota",
    dateStyle: "full",
    timeStyle: "short",
  };
  const start = new Date(startsAt).toLocaleString("es-CO", opts);
  if (!endsAt) return start;
  const end = new Date(endsAt).toLocaleString("es-CO", { timeZone: "America/Bogota", timeStyle: "short" });
  return `${start} – ${end}`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 12px 4px 0;color:#5c6b66;font-size:13px;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:4px 0;color:#16211d;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

function buildHtml(t: TicketEmail): string {
  const ev = t.event;
  const when = fmtRange(ev.startsAt, ev.endsAt);
  const place = [ev.locationName, ev.locationAddress, ev.locationCity].filter(Boolean).join(", ");
  const useNote = ev.multiEntry
    ? "Este código permite varios ingresos: preséntalo cada vez que entres."
    : "Este código es de un solo uso. Preséntalo en el punto de acceso.";

  return `
  <div style="background:#f3f6f5;padding:24px 0;font-family:'Nunito Sans',Segoe UI,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4eae8;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e4eae8;">
        <img src="${LOGO_URL}" alt="Comfenalco Antioquia" width="170" style="display:block;" />
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#16211d;">${ev.name}</h1>
        <p style="margin:0 0 20px;color:#5c6b66;font-size:14px;">Hola ${t.attendeeName}, esta es tu boleta de ingreso.</p>

        <table style="border-collapse:collapse;margin-bottom:20px;">
          ${when ? row("Fecha", when) : ""}
          ${place ? row("Lugar", place) : ""}
        </table>

        <div style="text-align:center;background:#f3f6f5;border-radius:12px;padding:20px;">
          <img src="cid:qr" alt="Código QR de ingreso" width="240" height="240" style="display:block;margin:0 auto;" />
          <p style="margin:12px 0 0;color:#5c6b66;font-size:13px;">${useNote}</p>
        </div>

        <p style="margin:20px 0 0;color:#98a5a0;font-size:12px;">
          Si no puedes ver el código, responde este correo. No compartas tu QR: es personal.
        </p>
      </div>
      <div style="padding:14px 24px;background:#005744;color:#cfe8df;font-size:12px;text-align:center;">
        Comfenalco Antioquia · Control de ingreso
      </div>
    </div>
  </div>`;
}

export async function sendTicketEmail(t: TicketEmail): Promise<void> {
  const qrPng = await QRCode.toBuffer(t.token, { width: 480, margin: 2 });
  const port = Number(process.env.SMTP_PORT ?? 587);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: t.to,
    subject: `Tu boleta — ${t.event.name}`,
    html: buildHtml(t),
    attachments: [{ filename: "boleta-qr.png", content: qrPng, cid: "qr" }],
  });
}
