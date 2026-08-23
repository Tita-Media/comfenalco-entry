import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

/**
 * DIAGNÓSTICO TEMPORAL de SMTP. Protegido con ?key=SMTP_TEST_KEY.
 * GET /api/smtp-test?key=...            -> verifica conexión/credenciales
 * GET /api/smtp-test?key=...&to=correo  -> además intenta enviar un correo simple
 * Eliminar cuando el envío quede confirmado.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== process.env.SMTP_TEST_KEY) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const config = {
    host: process.env.SMTP_HOST ?? null,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user: process.env.SMTP_USER ?? null,
    hasPass: Boolean(process.env.SMTP_PASS),
    from: process.env.SMTP_FROM ?? null,
  };

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: config.secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  let verify: string;
  try {
    await transporter.verify();
    verify = "OK";
  } catch (e) {
    return Response.json({ config, verify: "FALLO", error: (e as Error).message });
  }

  const to = url.searchParams.get("to");
  if (!to) return Response.json({ config, verify, sent: false });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: "Prueba SMTP — Tiquetera",
      text: "Correo de prueba desde Tiquetera (Resend).",
    });
    return Response.json({ config, verify, sent: true, messageId: info.messageId });
  } catch (e) {
    return Response.json({ config, verify, sent: false, sendError: (e as Error).message });
  }
}
