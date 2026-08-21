import nodemailer from "nodemailer";
import QRCode from "qrcode";

export type TicketEmail = {
  to: string;
  attendeeName: string;
  eventName: string;
  eventDate: string | null;
  token: string;
};

/** Sin SMTP configurado el envío se simula: útil para la demo sin credenciales. */
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendTicketEmail(t: TicketEmail): Promise<void> {
  const qrPng = await QRCode.toBuffer(t.token, { width: 480, margin: 2 });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: t.to,
    subject: `Tu boleta — ${t.eventName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${t.eventName}</h2>
        <p>Hola ${t.attendeeName},</p>
        <p>Esta es tu boleta de ingreso${t.eventDate ? ` para el ${t.eventDate}` : ""}.
        Presenta este código QR en el punto de acceso. Es de un solo uso.</p>
        <img src="cid:qr" alt="Código QR de ingreso" width="240" height="240" />
        <p style="color:#666; font-size: 12px;">Si no puedes ver el código, responde este correo.</p>
      </div>
    `,
    attachments: [{ filename: "boleta-qr.png", content: qrPng, cid: "qr" }],
  });
}
