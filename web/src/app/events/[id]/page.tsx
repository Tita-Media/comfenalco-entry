"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import {
  CfButton,
  CfBadge,
  CfAlert,
  CfKpiMetric,
  CfModal,
} from "comfenalco-ui-react";
import AuthGate from "@/components/AuthGate";
import EventForm, { EMPTY_EVENT, toLocalInput, type EventFormValue } from "@/components/EventForm";
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

const STATUS: Record<Ticket["status"], { label: string; variant: "secondary" | "warning" | "success" }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  issued: { label: "Emitida", variant: "warning" },
  redeemed: { label: "Validada", variant: "success" },
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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EventFormValue>(EMPTY_EVENT);
  const [operators, setOperators] = useState<{ id: string; email: string | null }[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Suscripción en vivo: cuando la app redime una boleta, refrescamos al instante.
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

  async function openEdit() {
    setError(null);
    try {
      type Ev = {
        name: string; starts_at: string | null; ends_at: string | null; max_capacity: number | null;
        send_mode: "deferred" | "immediate"; multi_entry: boolean; capture_geo: boolean;
        location_name: string | null; location_address: string | null; location_city: string | null;
        event_operators: { operator_email: string }[];
      };
      const [ev, ops] = await Promise.all([
        api<Ev>(`/api/events/${id}`),
        api<{ id: string; email: string | null }[]>("/api/operators").catch(() => []),
      ]);
      setOperators(ops);
      setForm({
        name: ev.name ?? "",
        starts_at: toLocalInput(ev.starts_at),
        ends_at: toLocalInput(ev.ends_at),
        max_capacity: ev.max_capacity != null ? String(ev.max_capacity) : "",
        send_mode: ev.send_mode ?? "deferred",
        multi_entry: ev.multi_entry,
        capture_geo: ev.capture_geo,
        location_name: ev.location_name ?? "",
        location_address: ev.location_address ?? "",
        location_city: ev.location_city ?? "",
        operators: ev.event_operators?.map((o) => o.operator_email) ?? [],
      });
      setEditing(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveEdit() {
    setSavingEdit(true);
    setError(null);
    setMsg(null);
    try {
      await api(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        }),
      });
      setEditing(false);
      setMsg("Evento actualizado.");
    } catch (e) {
      setError((e as Error).message);
    }
    setSavingEdit(false);
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
    <div className="stack">
      <div className="detail-top">
        <div>
          <Link href="/" className="eyebrow" style={{ textDecoration: "none" }}>
            ← Eventos
          </Link>
          <h1>Gestión de boletas</h1>
        </div>
        <div className="toolbar">
          <span className={`live-dot ${live ? "on" : "off"}`} title={live ? "Actualización en vivo" : "Reconectando…"}>
            ● {live ? "En vivo" : "…"}
          </span>
          <CfButton variant={editing ? "tertiary" : "secondary"} icon={editing ? "close" : "edit"} onClick={() => (editing ? setEditing(false) : openEdit())}>
            {editing ? "Cerrar edición" : "Editar evento"}
          </CfButton>
        </div>
      </div>

      {editing && (
        <section className="panel">
          <h2>Editar evento</h2>
          <EventForm value={form} onChange={setForm} operators={operators} />
          <div style={{ marginTop: "1.5rem" }}>
            <CfButton variant="primary" icon="save" isLoading={savingEdit} onClick={saveEdit}>
              Guardar cambios
            </CfButton>
          </div>
        </section>
      )}

      <div className="kpi-row">
        <CfKpiMetric label="Reservas" value={String(tickets.length)} icon="confirmation_number" />
        <CfKpiMetric label="Pendientes" value={String(counts.pending)} icon="schedule" />
        <CfKpiMetric label="Emitidas" value={String(counts.issued)} icon="mail" />
        <CfKpiMetric label="Validadas" value={String(counts.redeemed)} icon="check_circle" />
      </div>

      <section className="panel">
        <h2>1 · Cargar reservas</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Una por línea: <code>nombre,email,documento</code>. En producción esto lo alimenta la
          integración con el servicio de reportería.
        </p>
        <textarea
          rows={4}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"María Pérez,maria@example.com,10203040\nJuan Gómez,juan@example.com,50607080"}
          style={{
            width: "100%",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "0.7rem 0.85rem",
            font: "inherit",
            background: "var(--card)",
            color: "var(--ink)",
            resize: "vertical",
          }}
        />
        <div className="toolbar" style={{ marginTop: "0.85rem" }}>
          <CfButton variant="primary" icon="upload" isLoading={busy} disabled={!csv.trim()} onClick={importCsv}>
            Cargar reservas
          </CfButton>
          <CfButton variant="secondary" icon="qr_code_2" disabled={busy || counts.pending === 0} onClick={generate}>
            2 · Generar boletas ({counts.pending})
          </CfButton>
          <CfButton variant="secondary" icon="send" disabled={busy} onClick={() => sendEmails()}>
            3 · Enviar correos del lote
          </CfButton>
          <CfButton variant="tertiary" icon="refresh" disabled={busy} onClick={load}>
            Actualizar
          </CfButton>
        </div>
        {msg && <div style={{ marginTop: "0.85rem" }}><CfAlert variant="success">{msg}</CfAlert></div>}
        {error && <div style={{ marginTop: "0.85rem" }}><CfAlert variant="error">{error}</CfAlert></div>}
      </section>

      <section className="panel">
        <h2>Boletas</h2>
        <div className="table-wrap">
          <table className="tickets">
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
                    <CfBadge variant={STATUS[t.status].variant}>{STATUS[t.status].label}</CfBadge>
                  </td>
                  <td>{t.email_sent_at ? new Date(t.email_sent_at).toLocaleString() : "—"}</td>
                  <td>
                    {t.redeemed_at
                      ? `${new Date(t.redeemed_at).toLocaleString()} · ${t.redeemed_by ?? ""}`
                      : "—"}
                  </td>
                  <td>
                    <div className="cell-actions">
                      {t.token && (
                        <CfButton variant="tertiary" size="md" icon="qr_code_2" onClick={() => showQr(t)}>
                          QR
                        </CfButton>
                      )}
                      {t.status === "issued" && (
                        <CfButton variant="link" size="md" disabled={busy} onClick={() => sendEmails(t.id)}>
                          Reenviar
                        </CfButton>
                      )}
                    </div>
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
      </section>

      <CfModal
        isOpen={Boolean(qrPreview)}
        modalTitle={qrPreview ? `QR · ${qrPreview.name}` : "QR"}
        size="sm"
        onCfClose={() => setQrPreview(null)}
      >
        {qrPreview && (
          <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPreview.dataUrl} alt={`QR de ${qrPreview.name}`} width={240} height={240} />
          </div>
        )}
      </CfModal>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <EventDetail />
    </AuthGate>
  );
}
