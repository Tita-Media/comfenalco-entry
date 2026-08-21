"use client";

import { useEffect, useState } from "react";
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

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) setError("Credenciales inválidas");
    setBusy(false);
  }

  if (!ready) return <p className="muted">Cargando…</p>;

  if (!logged) {
    return (
      <div className="card" style={{ maxWidth: 380, margin: "4rem auto" }}>
        <h1>Tiquetera</h1>
        <p className="muted">Acceso de operadores</p>
        <form onSubmit={login} style={{ display: "grid", gap: "0.6rem" }}>
          <input
            type="email"
            placeholder="correo@titamedia.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <span className="error">{error}</span>}
          <button disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: "0.5rem" }}>
        <button className="secondary" onClick={() => supabaseBrowser().auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
      {children}
    </>
  );
}
