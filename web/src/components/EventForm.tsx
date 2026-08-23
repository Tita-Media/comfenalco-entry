"use client";

import { CfInput, CfSelect, CfCheckbox } from "comfenalco-ui-react";

export type EventFormValue = {
  name: string;
  starts_at: string;
  ends_at: string;
  max_capacity: string;
  send_mode: "deferred" | "immediate";
  multi_entry: boolean;
  capture_geo: boolean;
  location_name: string;
  location_address: string;
  location_city: string;
  operators: string[];
};

export const EMPTY_EVENT: EventFormValue = {
  name: "", starts_at: "", ends_at: "", max_capacity: "", send_mode: "deferred",
  multi_entry: false, capture_geo: false, location_name: "", location_address: "",
  location_city: "", operators: [],
};

/** ISO (con zona) → valor para <input datetime-local> (YYYY-MM-DDTHH:mm local). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  value: EventFormValue;
  onChange: (v: EventFormValue) => void;
  operators: { id: string; email: string | null }[];
};

export default function EventForm({ value, onChange, operators }: Props) {
  const set = <K extends keyof EventFormValue>(k: K, v: EventFormValue[K]) => onChange({ ...value, [k]: v });
  const toggleOp = (email: string) =>
    set("operators", value.operators.includes(email) ? value.operators.filter((e) => e !== email) : [...value.operators, email]);

  return (
    <>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <CfInput label="Nombre del evento" value={value.name} onCfChange={(e) => set("name", e.detail)} />
        <CfSelect
          label="Modo de envío del QR"
          value={value.send_mode}
          options={[
            { value: "deferred", label: "Diferido (al cierre)" },
            { value: "immediate", label: "Inmediato" },
          ]}
          onCfChange={(e) => set("send_mode", e.detail as "deferred" | "immediate")}
        />
        <label className="native-field">
          <span>Inicio</span>
          <input type="datetime-local" value={value.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
        </label>
        <label className="native-field">
          <span>Fin</span>
          <input type="datetime-local" value={value.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
        </label>
        <CfInput
          label="Capacidad máxima (opcional)"
          type="number"
          placeholder="Sin límite"
          value={value.max_capacity}
          onCfChange={(e) => set("max_capacity", e.detail)}
        />
        <div />
      </div>

      <h3 style={{ margin: "1.25rem 0 0.5rem" }}>Ubicación (para el correo del QR)</h3>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <CfInput label="Lugar" value={value.location_name} onCfChange={(e) => set("location_name", e.detail)} />
        <CfInput label="Dirección" value={value.location_address} onCfChange={(e) => set("location_address", e.detail)} />
        <CfInput label="Ciudad" value={value.location_city} onCfChange={(e) => set("location_city", e.detail)} />
      </div>

      <h3 style={{ margin: "1.25rem 0 0.5rem" }}>Opciones de ingreso</h3>
      <div style={{ display: "grid", gap: "0.6rem" }}>
        <CfCheckbox checked={value.multi_entry} onCfChange={(e) => set("multi_entry", e.detail)}>
          Permitir múltiples ingresos con el mismo QR (registra cada ingreso)
        </CfCheckbox>
        <CfCheckbox checked={value.capture_geo} onCfChange={(e) => set("capture_geo", e.detail)}>
          Capturar geolocalización en cada ingreso
        </CfCheckbox>
      </div>

      <h3 style={{ margin: "1.25rem 0 0.5rem" }}>Operadores habilitados</h3>
      {operators.length === 0 ? (
        <p className="muted">No hay operadores. Créalos en la sección Operadores.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.4rem" }}>
          {operators.map((op) => (
            <CfCheckbox key={op.id} checked={value.operators.includes(op.email ?? "")} onCfChange={() => toggleOp(op.email ?? "")}>
              {op.email}
            </CfCheckbox>
          ))}
        </div>
      )}
    </>
  );
}
