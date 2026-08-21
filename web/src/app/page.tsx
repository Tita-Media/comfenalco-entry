"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/AuthGate";
import { api } from "@/lib/supabaseBrowser";

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  send_mode: "immediate" | "deferred";
  tickets: { count: number }[];
};

function EventsPage() {
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

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <>
      <h1>Eventos</h1>

      <div className="card">
        <form onSubmit={createEvent} className="row">
          <input
            placeholder="Nombre del evento"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ flex: 1, minWidth: 200 }}
          />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={sendMode} onChange={(e) => setSendMode(e.target.value as "deferred" | "immediate")}>
            <option value="deferred">Envío diferido (al cierre)</option>
            <option value="immediate">Envío inmediato</option>
          </select>
          <button disabled={busy}>Crear evento</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Fecha</th>
              <th>Envío</th>
              <th>Boletas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.name}</td>
                <td>{ev.event_date ?? "—"}</td>
                <td>{ev.send_mode === "immediate" ? "Inmediato" : "Diferido"}</td>
                <td>{ev.tickets?.[0]?.count ?? 0}</td>
                <td>
                  <Link href={`/events/${ev.id}`}>Gestionar →</Link>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Sin eventos todavía.
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
      <EventsPage />
    </AuthGate>
  );
}
