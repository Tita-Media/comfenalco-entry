import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Cliente con service role: solo se usa en el servidor. Nunca exponerlo al browser. */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        // Next.js parchea fetch y cachea los GET por defecto; forzar no-store
        // para que las lecturas a PostgREST siempre traigan datos frescos.
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) =>
            fetch(input, { ...init, cache: "no-store" }),
        },
      }
    );
  }
  return client;
}

/** Valida el JWT de Supabase Auth que envían backoffice y app móvil. */
export async function requireUser(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function unauthorized() {
  return Response.json({ error: "No autorizado" }, { status: 401 });
}
