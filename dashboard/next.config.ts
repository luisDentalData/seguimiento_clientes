import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habilitar modo standalone para Docker
  // Genera un servidor auto-contenido con solo las deps necesarias
  output: 'standalone',

  // Opcional: Configurar hostname para permitir conexiones externas
  // En Docker necesitamos escuchar en 0.0.0.0 (todas las interfaces)
};

export default nextConfig;
