"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import AuthGate from "@/components/AuthGate";
import { api, supabaseBrowser } from "@/lib/supabaseBrowser";

type Ticket = {
  id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_doc: string | null;
  token: string | null;
  status: "pending" | "issued" | "redeemed";
  email_sent_at: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
};

const STATUS_LABEL: Record<Ticket["status"], string> = {
  pending: "Pendiente",
  issued: "Emitida",
  redeemed: "Validada",
};

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrPreview, setQrPreview] = useState<{ name: string; dataUrl: string } | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await api<Ticket[]>(`/api/tickets?event_id=${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Suscripción en vivo: cuando la app redime una boleta de este evento,
  // Supabase Realtime nos avisa y refrescamos la grilla al instante.
  useEffect(() => {
    const sb = supabaseBrowser();
    let channel: ReturnType<typeof sb.channel> | null = null;
    (async () => {
      const { data } = await sb.auth.getSession();
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      channel = sb
        .channel(`tickets-${id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets", filter: `event_id=eq.${id}` },
          () => load()
        )
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    })();
    return () => {
      if (channel) sb.removeChannel(channel);
    };
  }, [id, load]);

  async function run(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      setMsg(await fn());
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  function importCsv() {
    // Formato: nombre,email,documento (una reserva por línea)
    const rows = csv
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name, email, doc] = l.split(",").map((s) => s?.trim());
        return { name, email, doc };
      });
    return run(async () => {
      const r = await api<{ inserted: number; skipped: number }>("/api/tickets/import", {
        method: "POST",
        body: JSON.stringify({ event_id: id, rows }),
      });
      setCsv("");
      return `${r.inserted} reservas cargadas${r.skipped ? `, ${r.skipped} filas ignoradas` : ""}.`;
    });
  }

  function generate() {
    return run(async () => {
      const r = await api<{ generated: number }>("/api/tickets/generate", {
        method: "POST",
        body: JSON.stringify({ event_id: id }),
      });
      return `${r.generated} boletas generadas.`;
    });
  }

  function sendEmails(ticketId?: string) {
    return run(async () => {
      const r = await api<{ sent: number; simulated: boolean; failures: string[] }>(
        "/api/tickets/send",
        { method: "POST", body: JSON.stringify({ event_id: id, ticket_id: ticketId }) }
      );
      const base = `${r.sent} correo(s) ${r.simulated ? "simulados (SMTP no configurado)" : "enviados"}.`;
      return r.failures?.length ? `${base} Fallaron: ${r.failures.join(", ")}` : base;
    });
  }

  async function showQr(t: Ticket) {
    if (!t.token) return;
    const dataUrl = await QRCode.toDataURL(t.token, { width: 320, margin: 2 });
    setQrPreview({ name: t.attendee_name, dataUrl });
  }

  const counts = {
    pending: tickets.filter((t) => t.status === "pending").length,
    issued: tickets.filter((t) => t.status === "issued").length,
    redeemed: tickets.filter((t) => t.status === "redeemed").length,
  };

  return (
    <>
      <p>
        <Link href="/">← Eventos</Link>
      </p>
      <h1>Gestión de boletas</h1>
      <p className="muted">
        {tickets.length} reservas · {counts.pending} pendientes · {counts.issued} emitidas ·{" "}
        {counts.redeemed} validadas{" "}
        <span
          title={live ? "Actualización en vivo activa" : "Reconectando…"}
          style={{
            marginLeft: 8,
            fontSize: "0.8rem",
            color: live ? "var(--ok)" : "var(--muted)",
            fontWeight: 600,
          }}
        >
          ● {live ? "En vivo" : "…"}
        </span>
      </p>

      <div className="card">
        <h2>1 · Cargar reservas</h2>
        <p className="muted">
          Una por línea: <code>nombre,email,documento</code>. (En producción esto lo alimenta la
          integración con el servicio de reportería.)
        </p>
        <textarea
          rows={4}
          style={{ width: "100%" }}
          placeholder={"María Pérez,maria@example.com,10203040\nJuan Gómez,juan@example.com,50607080"}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        <div className="row" style={{ marginTop: "0.6rem" }}>
          <button onClick={importCsv} disabled={busy || !csv.trim()}>
            Cargar reservas
          </button>
          <button className="secondary" onClick={generate} disabled={busy || counts.pending === 0}>
            2 · Generar boletas ({counts.pending})
          </button>
          <button className="secondary" onClick={() => sendEmails()} disabled={busy}>
            3 · Enviar correos del lote
          </button>
          <button className="secondary" onClick={load} disabled={busy}>
            Actualizar
          </button>
        </div>
        {msg && <p className="muted">{msg}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      {qrPreview && (
        <div className="card" style={{ textAlign: "center" }}>
          <p>
            <strong>{qrPreview.name}</strong>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrPreview.dataUrl} alt={`QR de ${qrPreview.name}`} width={220} height={220} />
          <div>
            <button className="secondary" onClick={() => setQrPreview(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Asistente</th>
              <th>Email</th>
              <th>Documento</th>
              <th>Estado</th>
              <th>Correo</th>
              <th>Validación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td>{t.attendee_name}</td>
                <td>{t.attendee_email}</td>
                <td>{t.attendee_doc ?? "—"}</td>
                <td>
                  <span className={`pill ${t.status}`}>{STATUS_LABEL[t.status]}</span>
                </td>
                <td>{t.email_sent_at ? new Date(t.email_sent_at).toLocaleString() : "—"}</td>
                <td>
                  {t.redeemed_at
                    ? `${new Date(t.redeemed_at).toLocaleString()} · ${t.redeemed_by ?? ""}`
                    : "—"}
                </td>
                <td className="row">
                  {t.token && (
                    <button className="secondary" onClick={() => showQr(t)}>
                      QR
                    </button>
                  )}
                  {t.status === "issued" && (
                    <button className="secondary" onClick={() => sendEmails(t.id)} disabled={busy}>
                      Reenviar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Sin reservas cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <EventDetail />
    </AuthGate>
  );
}
