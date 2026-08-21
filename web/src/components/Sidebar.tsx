"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CfButton } from "comfenalco-ui-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type NavItem = {
  label: string;
  href?: string;
  glyph: string;
  match?: (path: string) => boolean;
  soon?: boolean;
};

// Secciones. Agregar aquí las nuevas a medida que se implementen.
const NAV: NavItem[] = [
  { label: "Eventos", href: "/", glyph: "▤", match: (p) => p === "/" || p.startsWith("/events") },
  { label: "Ingresos", glyph: "≣", soon: true },
  { label: "Reportes", glyph: "◪", soon: true },
  { label: "Ajustes", glyph: "⚙", soon: true },
];

export default function Sidebar({ email }: { email?: string | null }) {
  const path = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/comfenalco-logo.svg" alt="Comfenalco Antioquia" />
      </div>

      <nav className="nav">
        {NAV.map((item) => {
          const active = item.match?.(path) ?? false;
          if (item.soon || !item.href) {
            return (
              <span key={item.label} className="nav-item disabled" aria-disabled="true">
                <span className="nav-glyph">{item.glyph}</span>
                {item.label}
                <span className="badge-soon">Pronto</span>
              </span>
            );
          }
          return (
            <Link key={item.label} href={item.href} className={`nav-item${active ? " active" : ""}`}>
              <span className="nav-glyph">{item.glyph}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {email && <p className="sidebar-user" title={email}>{email}</p>}
        <CfButton variant="tertiary" icon="logout" onClick={() => supabaseBrowser().auth.signOut()}>
          Cerrar sesión
        </CfButton>
      </div>
    </aside>
  );
}
