"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CfButton, CfInput, CfSelect, CfTable, CfCheckbox, CfAlert } from "comfenalco-ui-react";
import type { CfTableColumn, CfTableRow } from "comfenalco-ui-wc";
import AuthGate from "@/components/AuthGate";
import { api } from "@/lib/supabaseBrowser";

type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  max_capacity: number | null;
  multi_entry: boolean;
  capture_geo: boolean;
  location_name: string | null;
  location_city: string | null;
  send_mode: "immediate" | "deferred";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    starts_at: "",
    ends_at: "",
    max_capacity: "",
    send_mode: "deferred" as "deferred" | "immediate",
    multi_entry: false,
    capture_geo: false,
    location_name: "",
    location_address: "",
    location_city: "",
    operators: [] as string[],
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
          name: form.name,
          starts_at: form.starts_at || null,
          ends_at: form.ends_at || null,
          max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
          send_mode: form.send_mode,
          multi_entry: form.multi_entry,
          capture_geo: form.capture_geo,
          location_name: form.location_name || null,
          location_address: form.location_address || null,
          location_city: form.location_city || null,
          operators: form.operators,
        }),
      });
      setForm({
        name: "", starts_at: "", ends_at: "", max_capacity: "", send_mode: "deferred",
        multi_entry: false, capture_geo: false, location_name: "", location_address: "",
        location_city: "", operators: [],
      });
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

  const toggleOperator = (email: string) =>
    set(
      "operators",
      form.operators.includes(email)
        ? form.operators.filter((e) => e !== email)
        : [...form.operators, email]
    );

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
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
            <CfInput label="Nombre del evento" value={form.name} onCfChange={(e) => set("name", e.detail)} />
            <CfSelect
              label="Modo de envío del QR"
              value={form.send_mode}
              options={[
                { value: "deferred", label: "Diferido (al cierre)" },
                { value: "immediate", label: "Inmediato" },
              ]}
              onCfChange={(e) => set("send_mode", e.detail as "deferred" | "immediate")}
            />
            <label className="native-field">
              <span>Inicio</span>
              <input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </label>
            <label className="native-field">
              <span>Fin</span>
              <input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
            </label>
            <CfInput
              label="Capacidad máxima (opcional)"
              type="number"
              placeholder="Sin límite"
              value={form.max_capacity}
              onCfChange={(e) => set("max_capacity", e.detail)}
            />
            <div />
          </div>

          <h3 style={{ margin: "1.25rem 0 0.5rem" }}>Ubicación (para el correo del QR)</h3>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <CfInput label="Lugar" value={form.location_name} onCfChange={(e) => set("location_name", e.detail)} />
            <CfInput label="Dirección" value={form.location_address} onCfChange={(e) => set("location_address", e.detail)} />
            <CfInput label="Ciudad" value={form.location_city} onCfChange={(e) => set("location_city", e.detail)} />
          </div>

          <h3 style={{ margin: "1.25rem 0 0.5rem" }}>Opciones de ingreso</h3>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            <CfCheckbox checked={form.multi_entry} onCfChange={(e) => set("multi_entry", e.detail)}>
              Permitir múltiples ingresos con el mismo QR (registra cada ingreso)
            </CfCheckbox>
            <CfCheckbox checked={form.capture_geo} onCfChange={(e) => set("capture_geo", e.detail)}>
              Capturar geolocalización en cada ingreso
            </CfCheckbox>
          </div>

          <h3 style={{ margin: "1.25rem 0 0.5rem" }}>Operadores habilitados</h3>
          {operators.length === 0 ? (
            <p className="muted">No hay operadores. Créalos en la sección Operadores.</p>
          ) : (
            <div style={{ display: "grid", gap: "0.4rem" }}>
              {operators.map((op) => (
                <CfCheckbox
                  key={op.id}
                  checked={form.operators.includes(op.email ?? "")}
                  onCfChange={() => toggleOperator(op.email ?? "")}
                >
                  {op.email}
                </CfCheckbox>
              ))}
            </div>
          )}

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
