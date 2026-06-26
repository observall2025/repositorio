import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repositorio de Documentos",
  description: "Upload e compartilhamento simples de documentos."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
