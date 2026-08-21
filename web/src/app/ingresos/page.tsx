"use client";

import { useCallback, useEffect, useState } from "react";
import { CfTable, CfButton, CfAlert } from "comfenalco-ui-react";
import type { CfTableColumn, CfTableRow } from "comfenalco-ui-wc";
import AuthGate from "@/components/AuthGate";
import { api } from "@/lib/supabaseBrowser";

type Ingreso = {
  id: string;
  attendee_name: string;
  attendee_doc: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  events: { name: string } | null;
};

const COLUMNS: CfTableColumn[] = [
  { header: "Asistente", accessor: "name" },
  { header: "Documento", accessor: "doc" },
  { header: "Evento", accessor: "evento" },
  { header: "Hora", accessor: "hora" },
  { header: "Operador", accessor: "operador" },
];

function IngresosPage() {
  const [items, setItems] = useState<Ingreso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setItems(await api<Ingreso[]>("/api/scan/history"));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows: CfTableRow[] = items.map((i) => ({
    id: i.id,
    name: i.attendee_name,
    doc: i.attendee_doc ?? "—",
    evento: i.events?.name ?? "—",
    hora: i.redeemed_at ? new Date(i.redeemed_at).toLocaleString() : "—",
    operador: i.redeemed_by ?? "—",
  }));

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <header className="detail-top">
        <div>
          <p className="eyebrow">Backoffice · Check-in</p>
          <h1>Ingresos realizados</h1>
        </div>
        <CfButton variant="tertiary" icon="refresh" isLoading={busy} onClick={load}>
          Actualizar
        </CfButton>
      </header>

      <section className="panel">
        <h2>{items.length} ingreso(s)</h2>
        {error && <div style={{ marginBottom: "1rem" }}><CfAlert variant="error">{error}</CfAlert></div>}
        {rows.length === 0 && !busy ? (
          <p className="muted">Aún no hay ingresos registrados. Aparecerán aquí en cuanto el personal valide boletas.</p>
        ) : (
          <CfTable columns={COLUMNS} data={rows} rowKeyField="id" ariaLabel="Ingresos realizados" />
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <IngresosPage />
    </AuthGate>
  );
}
