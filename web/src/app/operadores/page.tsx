"use client";

import { useCallback, useEffect, useState } from "react";
import { CfButton, CfInput, CfAlert, CfSkeletonTable } from "comfenalco-ui-react";
import AuthGate from "@/components/AuthGate";
import { api } from "@/lib/supabaseBrowser";

type Operator = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  disabled: boolean;
};

function OperadoresPage() {
  const [ops, setOps] = useState<Operator[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setOps(await api<Operator[]>("/api/operators"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api("/api/operators", { method: "POST", body: JSON.stringify({ email, password }) });
      setMsg(`Operador ${email} creado.`);
      setEmail("");
      setPassword("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function remove(op: Operator) {
    if (!confirm(`¿Eliminar al operador ${op.email}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/operators?id=${op.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <header>
        <p className="eyebrow">Backoffice · Acceso</p>
        <h1>Operadores</h1>
      </header>

      <section className="panel">
        <h2>Crear operador</h2>
        <div className="form-grid" style={{ gridTemplateColumns: "1.5fr 1.5fr auto" }}>
          <CfInput label="Correo" type="text" icon="mail" value={email} onCfChange={(e) => setEmail(e.detail)} />
          <label className="native-field">
            <span>Contraseña (8+ caracteres)</span>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </label>
          <div className="form-action">
            <CfButton variant="primary" icon="person_add" isLoading={busy} onClick={create}>
              Crear
            </CfButton>
          </div>
        </div>
        {msg && <div style={{ marginTop: "1rem" }}><CfAlert variant="success">{msg}</CfAlert></div>}
        {error && <div style={{ marginTop: "1rem" }}><CfAlert variant="error">{error}</CfAlert></div>}
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          La contraseña se muestra en claro para que puedas entregarla al operador; pídele cambiarla después.
        </p>
      </section>

      <section className="panel">
        <h2>{loading ? "Operadores" : `${ops.length} operador(es)`}</h2>
        {loading ? (
          <CfSkeletonTable rows={3} ariaLabel="Cargando operadores" />
        ) : (
        <div className="table-wrap">
          <table className="tickets">
            <thead>
              <tr>
                <th>Correo</th>
                <th>Último ingreso</th>
                <th>Creado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op) => (
                <tr key={op.id}>
                  <td>{op.email}</td>
                  <td>{op.last_sign_in_at ? new Date(op.last_sign_in_at).toLocaleString() : "Nunca"}</td>
                  <td>{new Date(op.created_at).toLocaleDateString()}</td>
                  <td>
                    <CfButton variant="link" size="md" disabled={busy} onClick={() => remove(op)}>
                      Eliminar
                    </CfButton>
                  </td>
                </tr>
              ))}
              {ops.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">Sin operadores todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <OperadoresPage />
    </AuthGate>
  );
}
