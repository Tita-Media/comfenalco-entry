"use client";

import { useEffect, useState } from "react";
import { CfButton, CfInput, CfAlert } from "comfenalco-ui-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/** Login de operadores con Supabase Auth (usuarios creados desde el dashboard de Supabase). */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [logged, setLogged] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setLogged(Boolean(data.session));
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setLogged(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login() {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) setError("Credenciales inválidas");
    setBusy(false);
  }

  if (!ready) return <p className="muted">Cargando…</p>;

  if (!logged) {
    return (
      <div className="login-wrap">
        <div className="panel login-card">
          <div>
            <p className="eyebrow">Tiquetera</p>
            <h1>Acceso de operadores</h1>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
            style={{ display: "grid", gap: "1rem" }}
          >
            <CfInput
              label="Correo"
              type="text"
              icon="mail"
              placeholder="correo@titamedia.com"
              value={email}
              onCfChange={(e) => setEmail(e.detail)}
            />
            <label className="native-field">
              <span>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error && <CfAlert variant="error">{error}</CfAlert>}
            <CfButton variant="primary" size="lg" type="submit" isLoading={busy}>
              Ingresar
            </CfButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar" style={{ justifyContent: "flex-end", marginBottom: "1rem" }}>
        <CfButton variant="tertiary" icon="logout" onClick={() => supabaseBrowser().auth.signOut()}>
          Cerrar sesión
        </CfButton>
      </div>
      {children}
    </>
  );
}
