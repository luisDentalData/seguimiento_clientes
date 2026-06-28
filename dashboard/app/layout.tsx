import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Sidebar from "@/components/Sidebar";
import SyncButton from "@/components/SyncButton";

export const metadata: Metadata = {
  title: "DentalData Analytics | Sistema de Análisis de Reuniones",
  description: "Dashboard de análisis de reuniones y métricas de analistas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Syne:wght@400..800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64">
            <div className="p-8">
              {children}
            </div>
          </main>
          <SyncButton />
        </div>
      </body>
    </html>
  );
}
