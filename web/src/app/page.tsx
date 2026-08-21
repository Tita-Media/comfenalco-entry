"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CfButton, CfInput, CfSelect, CfTable, CfAlert } from "comfenalco-ui-react";
import type { CfTableColumn, CfTableRow } from "comfenalco-ui-wc";
import AuthGate from "@/components/AuthGate";
import { api } from "@/lib/supabaseBrowser";

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  send_mode: "immediate" | "deferred";
  tickets: { count: number }[];
};

const COLUMNS: CfTableColumn[] = [
  { header: "Evento", accessor: "name" },
  { header: "Fecha", accessor: "fecha" },
  { header: "Envío", accessor: "envio" },
  { header: "Boletas", accessor: "boletas" },
];

function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [sendMode, setSendMode] = useState<"deferred" | "immediate">("deferred");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await api<EventRow[]>("/api/events"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createEvent() {
    if (!name.trim()) {
      setError("El nombre del evento es obligatorio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/events", {
        method: "POST",
        body: JSON.stringify({ name, event_date: date || null, send_mode: sendMode }),
      });
      setName("");
      setDate("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const rows: CfTableRow[] = events.map((ev) => ({
    id: ev.id,
    name: ev.name,
    fecha: ev.event_date ?? "—",
    envio: ev.send_mode === "immediate" ? "Inmediato" : "Diferido",
    boletas: String(ev.tickets?.[0]?.count ?? 0),
  }));

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <header>
        <p className="eyebrow">Backoffice · Boletería</p>
        <h1>Eventos</h1>
      </header>

      <section className="panel">
        <h2>Crear evento</h2>
        <div className="form-grid">
          <CfInput
            label="Nombre del evento"
            placeholder="Carrera de las Flores"
            value={name}
            onCfChange={(e) => setName(e.detail)}
          />
          <label className="native-field">
            <span>Fecha</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <CfSelect
            label="Modo de envío"
            value={sendMode}
            options={[
              { value: "deferred", label: "Diferido (al cierre)" },
              { value: "immediate", label: "Inmediato" },
            ]}
            onCfChange={(e) => setSendMode(e.detail as "deferred" | "immediate")}
          />
          <div className="form-action">
            <CfButton variant="primary" icon="add" isLoading={busy} onClick={createEvent}>
              Crear evento
            </CfButton>
          </div>
        </div>
        {error && (
          <div style={{ marginTop: "1rem" }}>
            <CfAlert variant="error">{error}</CfAlert>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Eventos activos</h2>
        {rows.length === 0 ? (
          <p className="muted">Aún no hay eventos. Crea el primero arriba.</p>
        ) : (
          <CfTable
            columns={COLUMNS}
            data={rows}
            rowKeyField="id"
            rowClickable
            ariaLabel="Listado de eventos"
            onCfRowClick={(e) => router.push(`/events/${e.detail.id}`)}
          />
        )}
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Haz clic en un evento para gestionar sus boletas.
        </p>
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
