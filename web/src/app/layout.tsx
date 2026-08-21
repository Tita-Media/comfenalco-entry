import type { Metadata } from "next";
import "comfenalco-ui-react/styles";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tiquetera — Backoffice",
  description: "Gestión de boletería y check-in con códigos QR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
