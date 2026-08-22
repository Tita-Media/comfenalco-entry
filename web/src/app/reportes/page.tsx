"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CfKpiMetric, CfSelect, CfButton, CfAlert } from "comfenalco-ui-react";
import AuthGate from "@/components/AuthGate";
import { api } from "@/lib/supabaseBrowser";
import type { GeoEntry } from "@/components/EntriesMap";

const EntriesMap = dynamic(() => import("@/components/EntriesMap"), {
  ssr: false,
  loading: () => <p className="muted">Cargando mapa…</p>,
});

type Entry = {
  scanned_at: string;
  lat: number | null;
  lng: number | null;
  operator: string | null;
  event_id: string;
  events: { name: string } | null;
};
type ReportData = { entries: Entry[]; events: { id: string; name: string }[] };

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function ReportesPage() {
  const [data, setData] = useState<ReportData>({ entries: [], events: [] });
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = eventId ? `?event_id=${eventId}` : "";
      setData(await api<ReportData>(`/api/reports${qs}`));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const { entries } = data;

  const stats = useMemo(() => {
    const hourly = new Array(24).fill(0) as number[];
    const heat: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const ops = new Set<string>();
    const evs = new Set<string>();
    const geo: GeoEntry[] = [];
    let maxHeat = 0;
    for (const e of entries) {
      const d = new Date(e.scanned_at);
      hourly[d.getHours()]++;
      heat[d.getDay()][d.getHours()]++;
      maxHeat = Math.max(maxHeat, heat[d.getDay()][d.getHours()]);
      if (e.operator) ops.add(e.operator);
      evs.add(e.event_id);
      if (typeof e.lat === "number" && typeof e.lng === "number") {
        geo.push({
          lat: e.lat,
          lng: e.lng,
          label: e.events?.name ?? "Ingreso",
          time: d.toLocaleString(),
        });
      }
    }
    const maxHour = Math.max(1, ...hourly);
    return { hourly, heat, maxHeat: Math.max(1, maxHeat), maxHour, ops: ops.size, evs: evs.size, geo };
  }, [entries]);

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <header className="detail-top">
        <div>
          <p className="eyebrow">Backoffice · Analítica</p>
          <h1>Reportes de ingresos</h1>
        </div>
        <div className="toolbar">
          <CfSelect
            value={eventId}
            options={[{ value: "", label: "Todos los eventos" }, ...data.events.map((e) => ({ value: e.id, label: e.name }))]}
            onCfChange={(e) => setEventId(e.detail)}
          />
          <CfButton variant="tertiary" icon="refresh" isLoading={busy} onClick={load}>
            Actualizar
          </CfButton>
        </div>
      </header>

      {error && <CfAlert variant="error">{error}</CfAlert>}

      <div className="kpi-row">
        <CfKpiMetric label="Ingresos totales" value={String(entries.length)} icon="login" />
        <CfKpiMetric label="Eventos con ingresos" value={String(stats.evs)} icon="event" />
        <CfKpiMetric label="Operadores activos" value={String(stats.ops)} icon="group" />
        <CfKpiMetric label="Con geolocalización" value={String(stats.geo.length)} icon="location_on" />
      </div>

      <section className="panel">
        <h2>Ingresos por hora del día</h2>
        <div className="bars">
          {stats.hourly.map((v, h) => (
            <div key={h} className="bar-col" title={`${h}:00 — ${v} ingresos`}>
              <div className="bar" style={{ height: `${(v / stats.maxHour) * 100}%` }} />
              <span className="bar-label">{h}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Mapa de horas (día × hora)</h2>
        <div className="table-wrap">
          <div className="heat">
            <div className="heat-row heat-head">
              <span className="heat-day" />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="heat-hh">{h}</span>
              ))}
            </div>
            {stats.heat.map((row, d) => (
              <div key={d} className="heat-row">
                <span className="heat-day">{DAYS[d]}</span>
                {row.map((v, h) => (
                  <span
                    key={h}
                    className="heat-cell"
                    title={`${DAYS[d]} ${h}:00 — ${v}`}
                    style={{ background: v === 0 ? "var(--line)" : `rgba(0,87,68,${0.15 + 0.85 * (v / stats.maxHeat)})` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Mapa geográfico de ingresos</h2>
        <EntriesMap points={stats.geo} />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <ReportesPage />
    </AuthGate>
  );
}
