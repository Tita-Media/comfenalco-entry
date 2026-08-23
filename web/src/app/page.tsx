"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CfButton, CfTable, CfAlert } from "comfenalco-ui-react";
import type { CfTableColumn, CfTableRow } from "comfenalco-ui-wc";
import AuthGate from "@/components/AuthGate";
import EventForm, { EMPTY_EVENT, type EventFormValue } from "@/components/EventForm";
import { api } from "@/lib/supabaseBrowser";

type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  max_capacity: number | null;
  location_name: string | null;
  location_city: string | null;
  tickets: { count: number }[];
  event_operators: { operator_email: string }[];
};

type Operator = { id: string; email: string | null };

const COLUMNS: CfTableColumn[] = [
  { header: "Evento", accessor: "name" },
  { header: "Fecha", accessor: "fecha" },
  { header: "Lugar", accessor: "lugar" },
  { header: "Boletas", accessor: "boletas" },
  { header: "Operadores", accessor: "ops" },
];

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";

function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EventFormValue>(EMPTY_EVENT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ev, ops] = await Promise.all([
        api<EventRow[]>("/api/events"),
        api<Operator[]>("/api/operators").catch(() => [] as Operator[]),
      ]);
      setEvents(ev);
      setOperators(ops);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEvent() {
    if (!form.name.trim()) {
      setError("El nombre del evento es obligatorio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
        }),
      });
      setForm(EMPTY_EVENT);
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const now = Date.now();
  const isPast = (ev: EventRow) => {
    const end = ev.ends_at ?? ev.starts_at;
    return end ? new Date(end).getTime() < now : false;
  };
  const toRow = (ev: EventRow): CfTableRow => ({
    id: ev.id,
    name: ev.name,
    fecha: ev.starts_at ? `${fmtDate(ev.starts_at)}${ev.ends_at ? ` → ${fmtDate(ev.ends_at)}` : ""}` : "—",
    lugar: [ev.location_name, ev.location_city].filter(Boolean).join(", ") || "—",
    boletas: `${ev.tickets?.[0]?.count ?? 0}${ev.max_capacity ? ` / ${ev.max_capacity}` : ""}`,
    ops: String(ev.event_operators?.length ?? 0),
  });

  const vigentes = events.filter((e) => !isPast(e)).map(toRow);
  const pasados = events.filter(isPast).map(toRow);

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <header className="detail-top">
        <div>
          <p className="eyebrow">Backoffice · Boletería</p>
          <h1>Eventos</h1>
        </div>
        <CfButton variant={showForm ? "tertiary" : "primary"} icon={showForm ? "close" : "add"} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancelar" : "Crear evento"}
        </CfButton>
      </header>

      {error && <CfAlert variant="error">{error}</CfAlert>}

      {showForm && (
        <section className="panel">
          <h2>Nuevo evento</h2>
          <EventForm value={form} onChange={setForm} operators={operators} />
          <div style={{ marginTop: "1.5rem" }}>
            <CfButton variant="primary" icon="check" isLoading={busy} onClick={createEvent}>
              Crear evento
            </CfButton>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>Vigentes ({vigentes.length})</h2>
        {vigentes.length === 0 ? (
          <p className="muted">No hay eventos vigentes.</p>
        ) : (
          <CfTable columns={COLUMNS} data={vigentes} rowKeyField="id" rowClickable ariaLabel="Eventos vigentes" onCfRowClick={(e) => router.push(`/events/${e.detail.id}`)} />
        )}
      </section>

      <section className="panel">
        <h2>Pasados ({pasados.length})</h2>
        {pasados.length === 0 ? (
          <p className="muted">No hay eventos pasados.</p>
        ) : (
          <CfTable columns={COLUMNS} data={pasados} rowKeyField="id" rowClickable ariaLabel="Eventos pasados" onCfRowClick={(e) => router.push(`/events/${e.detail.id}`)} />
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <EventsPage />
    </AuthGate>
  );
}
